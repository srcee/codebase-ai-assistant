# Stage 4 — File Discovery, Exclusions, and Chunking (Pure Logic)

**Goal:** Deterministic, dependency-light ingestion logic that turns a repository directory into chunks with line ranges and hashes. No embeddings or DB writes yet.

**Status:** Done (PR #4)

**Prerequisites:** Stage 3. Fixture repositories in `libs/server/testing` (see decision 0003).

## Tasks

1. Create the `ingestion` feature module in `apps/api/src/app/modules/ingestion` and the fixture repositories in `libs/server/testing` (synthetic repos only, including a canary secret and symlink cases).
2. Decide and record initial limits in config: max file size, max total index size, max chunk size/overlap (tokens or characters), supported extensions (start: `.ts .tsx .js .jsx .mjs .cjs .json .md`).
3. File discovery:
   - Walk without following symlinks outside the repository root.
   - Apply built-in exclusions: `.git`, `node_modules`, `dist`, `build`, `coverage`, caches, lockfiles, minified/generated bundles, binaries, archives.
   - Always-excluded secrets: `.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `*.pfx`, credentials files; plus configurable extra patterns.
   - Honor `.gitignore` as an additional hint only.
   - Binary detection and a conservative secret-content scan (skip the file and record a reason, never log content).
   - Output per-file decision: `included` or `skipped(reason)`.
4. Language detection by extension.
5. Chunking:
   - TypeScript/JS: syntax-aware chunks (functions, classes, methods, exported consts) using the TypeScript compiler API; fall back to bounded line-based chunks on parse failure or other file types.
   - Deterministic splitting for oversized symbols with overlap.
   - Each chunk: `relativePath`, `language`, `symbolName?`, `startLine`, `endLine`, `content`, `chunkHash`; a `chunkingVersion` constant.
6. Content hashing (SHA-256) per file and per chunk.
7. Tree-sitter is optional and deferred unless the TS compiler approach proves insufficient.

## Tests

- Exclusion rules and secret filenames; canary secret never appears in output or logs.
- Symlink escape not followed; oversized and binary files skipped with reasons.
- Chunk boundaries and 1-based inclusive line ranges are exact (reconstructing the file from ranges matches source).
- Determinism: same input produces identical chunks and hashes.
- Malformed TS falls back gracefully.

## Definition of Done

- Running discovery + chunking over a fixture repo yields stable, snapshot-tested output.
- Limits and extensions documented.
