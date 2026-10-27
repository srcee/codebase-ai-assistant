# 0004: Ingestion discovery and chunking

Status: accepted (CAA-5)

## Context

Stage 6 will index repositories. Everything it embeds is chosen here, so the choices decide what can leave a repository and what retrieval can cite. Source files are untrusted input.

## Decision

- **Pure logic, no persistence.** `FileDiscoveryService` and `ChunkingService` (module `ingestion`) have no endpoints and no database access. Stage 6 stores their output.
- **Discovery is streaming and ordered.** An async generator walks directories with entries sorted by UTF-16 code unit, so output is identical on every platform and memory stays bounded.
- **Links are never followed.** Any symlink or junction is skipped with `symlink`, inside or outside the repository. The root is re-resolved through `PathPolicyService` and must equal the registered canonical path, so a root replaced by a link after registration fails closed with `RepositoryRootChangedError`.
- **Safe reads.** Files are opened only when `lstat` reports a regular file (FIFOs and devices are never opened), the identity after opening must match, and at most the file limit plus one byte is read.
- **Exclusion order.** Secret filenames, then built-in exclusions, then configured patterns, then `.gitignore`, then language. `.gitignore` files (any depth, at most 64 KiB, deeper rules override) are a hint and can never re-include anything excluded earlier. Configured patterns use `.gitignore` syntax via the `ignore` package; negations cannot re-include built-in or secret exclusions either.
- **Secret handling.** Filenames such as `.env*` (including `.env.example`), keys, certificates, and credentials files are never read. After reading, a file is skipped when it holds a private-key header, a known token shape, credentials in a URL, or a secret-named assignment of a quoted literal of 8+ characters. The scan returns a boolean, so no match can reach a log. All patterns use bounded quantifiers. The scan favors skipping; this repository's own docs can trigger it.
- **Text rules.** Files must be valid UTF-8 without NUL bytes in the first 8 KiB. A BOM is removed and CRLF or CR becomes LF before chunking. A line longer than `CHUNK_MAX_CHARS` skips the file (`line-too-long`): it cannot be cut on a line boundary and is almost always minified or generated.
- **Hashes.** `contentHash` is SHA-256 of the raw bytes. `chunkHash` is SHA-256 of the chunk content (normalized text), so identical code in two files shares a hash and an embedding. If stage 6 adds the path to the text it embeds, it must bump `CHUNKING_VERSION` and hash the path as well.
- **Chunk size is measured in characters.** Chunk boundaries must not depend on an embedding model, otherwise changing the model would change every chunk and hash and defeat reuse by `chunk_hash`. 2000 characters is about 700 tokens in the worst case for code, well below the context of local embedding models. Stage 5's embedder must reject, not truncate, input that does not fit. Chunks are cut only between lines.
- **Languages are a registry.** `constants/languages.ts` lists each language once with its extensions, optional exact filenames, and a chunking strategy (`typescript` or `lines`). The `Language` type, the extension and filename lookups, and the chunker choice are derived from it, so no extension can belong to two languages (a unit test asserts this). Configuration selects languages by id (`INGEST_LANGUAGES`, unset means all) instead of listing extensions; the config library only checks the shape, and `FileDiscoveryService` rejects unknown ids at startup. A well-known filename wins over the extension. Formats that commonly hold unquoted secrets (YAML, TOML, INI, `.properties`, XML, `.env`) are not in the registry; a language is added only if the content scan can cover its secret syntax. The scan therefore also catches unquoted `NAME_TOKEN=value` lines used by shell scripts, Dockerfiles, and Makefiles.
- **TypeScript and JavaScript are chunked by symbol.** The TypeScript compiler API parses the file. Top-level functions, classes, interfaces, type aliases, enums, namespaces, variable statements, and default exports each become a chunk, together with the JSDoc or comment directly above. Code between symbols becomes unnamed chunks. A class that exceeds the limit is split per member (`Class.member`) with a header chunk. Other oversized symbols become overlapping line windows that keep the symbol name. Symbols sharing a line are merged under the first name. Syntax errors are detected with the compiler's syntactic diagnostics, and any such file, and any parser failure, falls back to line windows. Tree-sitter stays deferred.
- **Line numbers** are 1-based and inclusive, counting LF only. Every non-blank line is covered by at least one chunk; blank lines at chunk edges are dropped.
- **Logging** is one line per discovery run: counts, bytes, and duration.
- **Fixtures are built at test time** by `buildSampleRepository` in `libs/server/testing`. `.gitignore` blocks committing secret names and Windows cannot reliably commit links, so committing fixtures would hide the cases that matter most. Their text is fixed, not faker output, so snapshots are stable.
- **Dependencies.** `ignore` for gitignore semantics. `typescript` moves from devDependencies to dependencies because the compiler now runs in the API.

## Consequences

- Limits are configuration, not code (`INGEST_*`, `CHUNK_*`); changing chunk limits changes chunks and should come with a `CHUNKING_VERSION` bump.
- Small adjacent symbols produce small chunks. Merging them is a possible later tuning, and would also need a version bump.
- Nothing yet bounds the number of directory entries; Stage 6 should cap files per job.
- `.git/info/exclude` and global git ignores are not read.
