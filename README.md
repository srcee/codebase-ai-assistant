# Codebase AI Assistant

A local-first Codebase RAG Assistant. It indexes repositories on your machine and answers natural-language questions about the code, with citations to repository, file path, and line range.

## Privacy invariant

In V1, repository source code and anything derived from it (chunks, embeddings, prompts, chat history) never leaves the machine. There are no hosted LLM or embedding APIs, no cloud vector stores, and no remote fallback. If local inference is unavailable, requests fail with a clear error.

## Status

Early development. Work is split into stages; see [docs/](docs/):

- [Project context and architecture](docs/Codebase_RAG_Assistant_Project_Context.md)
- Stage plans: `docs/stage-0.md` through `docs/stage-10.md`

## Planned stack

TypeScript, Nx, NestJS, React + Vite, PostgreSQL + pgvector, local inference via Ollama.

## Development

Requires Node 22+.

```bash
npm ci
cp .env.example .env   # then set POSTGRES_PASSWORD and the matching passwords in the URLs
npm run db:up          # PostgreSQL + pgvector on 127.0.0.1:5432
npm run db:migrate
npm run start:api      # http://127.0.0.1:3000/health
npm run start:web      # http://localhost:4200, proxies /api to the API
```

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `npm run lint`          | ESLint, including Nx module-boundary rules               |
| `npm run test`          | Unit and API tests (Jest for server, Vitest for web)     |
| `npm run test:coverage` | Tests with coverage thresholds (needs the test database) |
| `npm run build`         | Build all projects                                       |
| `npm run check`         | Lint, test, and build                                    |
| `npm run format`        | Prettier                                                 |
| `npm run secrets`       | Secret scan of the working tree (secretlint)             |

A pre-commit hook runs the secret scan and Prettier on staged files, then `npm run test:coverage`. The commit is rejected if any project is below its coverage threshold, so start the test database first (`npm run db:test:up`).

### Database

PostgreSQL with pgvector runs in Docker (`docker-compose.yml`), bound to `127.0.0.1`, with data in the named volume `pgdata` and credentials from `.env`.

| Command                                       | Purpose                                                           |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `npm run db:up` / `npm run db:down`           | Start / stop the dev database (data is kept)                      |
| `npm run db:migrate`                          | Apply migrations (repeatable)                                     |
| `npm run db:generate`                         | Generate a migration after editing `schema.ts`                    |
| `npm run db:reset`                            | Delete all local data, then start and migrate a fresh database    |
| `npm run db:test:up` / `npm run db:test:down` | Start / remove the throwaway test database (port 5433, in memory) |

Integration tests use `TEST_DATABASE_URL` and are skipped when it is unset. They drop the `public` schema, so the database name must end in `_test`. The API suite uses its own `<name>_api_test` database on the same server (created if missing) so it can run in parallel with the schema suite. `GET /health` returns 503 with `status: "degraded"` when the database is unreachable, the `vector` extension is missing, the schema is not migrated, or the embedding column dimension differs from `EMBEDDING_DIMENSIONS`.

### Layout

- `apps/api`: NestJS API (global validation rejects unknown fields; unexpected errors return a generic 500). Feature modules live here, for example `src/app/repositories` (path policy and `/repositories` endpoints).
- `apps/web`: React + Vite UI.
- `libs/shared/contracts`: DTO types shared with the frontend (`scope:shared`).
- `libs/shared/testing`, `libs/server/testing`, `libs/server/database/src/testing`: test-only factories (fishery + faker), canary secrets, sandbox and database helpers. See [decision 0003](docs/decisions/0003-test-data-factories.md).
- `libs/server/config`: validated environment configuration (`scope:server`).
- `libs/server/database`: Drizzle schema, migrations, and the NestJS connection module (`scope:server`).

The web app cannot import `scope:server` libraries; this is enforced by lint.

### Repositories API

Repositories can only be registered from directories inside `ALLOWED_REPO_ROOTS`. Responses carry a display name and a path relative to the allowed root, never an absolute path. See [docs/decisions/0002-repository-path-policy.md](docs/decisions/0002-repository-path-policy.md).

| Endpoint                   | Body              | Success                                                      |
| -------------------------- | ----------------- | ------------------------------------------------------------ |
| `POST /repositories`       | `{ path, name? }` | `201` with the repository (`name` defaults to the directory) |
| `GET /repositories`        |                   | `200` with a list ordered by name                            |
| `GET /repositories/:id`    |                   | `200` with the repository                                    |
| `DELETE /repositories/:id` |                   | `204`; files, chunks, and index jobs are deleted by cascade  |

Failure modes:

| Status | Cause                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | Invalid body or unknown field; malformed `:id`; relative, traversal (`..`), UNC, or device path; missing path or path outside the allowed roots (same message); not a directory; no `.git` |
| `404`  | Unknown repository id                                                                                                                                                                      |
| `409`  | The canonical path (after resolving links, case, and separators) is already registered                                                                                                     |
| `503`  | `DATABASE_URL` is not configured                                                                                                                                                           |

The API refuses to start on a non-loopback `API_HOST` unless `API_ALLOW_NON_LOOPBACK=true`, and logs a warning when it is set.

### Ingestion (file discovery and chunking)

The `ingestion` module turns a registered repository into chunks. It has no endpoints and writes nothing to the database yet; the indexing pipeline (Stage 6) calls it. See [decision 0004](docs/decisions/0004-ingestion-discovery-and-chunking.md).

- `FileDiscoveryService.discover(canonicalPath)` walks the repository in a stable order and yields one entry per file or excluded directory: `included` (language, size, SHA-256 of the raw bytes, decoded text) or `skipped` with a reason. Links and junctions are never followed.
- `ChunkingService.chunk(file)` returns chunks with `relativePath`, `language`, `symbolName?`, 1-based inclusive `startLine` and `endLine`, `content`, and a SHA-256 `chunkHash`. `CHUNKING_VERSION` identifies the algorithm.
- Languages are defined once in `ingestion/constants/languages.ts`: an id, its extensions, optional exact filenames (`Dockerfile`, `Makefile`), and a chunking strategy. TypeScript and JavaScript are chunked by symbol; every other language (Python, Go, Java, Kotlin, Scala, Rust, C#, C, C++, Swift, Dart, Ruby, PHP, Perl, Lua, R, Julia, Elixir, Erlang, Haskell, Clojure, Zig, shell, PowerShell, SQL, HTML, CSS/SCSS/Less, Vue, Svelte, GraphQL, Protobuf, Terraform, Dockerfile, Makefile, plus JSON and Markdown) is chunked by whole lines. YAML, TOML, INI, `.properties`, XML, and `.env` are deliberately not indexed because they commonly hold unquoted secrets. To add a language, add one entry to that list; a new symbol-aware chunker is only needed for better chunk boundaries.
- Skip reasons: `symlink`, `excluded-path` (VCS, dependencies, build output, caches, lockfiles, minified bundles, binaries, archives), `secret-filename` (`.env*`, keys, certificates, `id_rsa*`, credentials files), `custom-exclusion`, `gitignored`, `unsupported-extension`, `too-large`, `total-size-limit`, `unreadable`, `binary`, `invalid-encoding`, `line-too-long`, `secret-content`.
- Skip reasons are the only trace of a skipped file. Content, matches, and paths are never logged.
- Failure modes: discovery throws `PathRejectedError` when the root is outside the allowed roots or no longer a repository, and `RepositoryRootChangedError` when the root is unreadable or resolves to a different path than the one registered (for example it was replaced by a link). Neither message contains a path.
- The secret scan is deliberately conservative and favors skipping: documentation or tests that contain token-like examples can be skipped as `secret-content`.

### Environment variables

Configuration is validated at startup; invalid values stop the API. See [.env.example](.env.example).

| Variable                                                                                                       | Default                  | Notes                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `API_HOST`                                                                                                     | `127.0.0.1`              | Non-loopback values are rejected unless opted in below                        |
| `API_PORT`                                                                                                     | `3000`                   |                                                                               |
| `API_ALLOW_NON_LOOPBACK`                                                                                       | `false`                  | Explicit opt-in to bind a non-loopback interface                              |
| `DATABASE_URL`                                                                                                 | unset                    | PostgreSQL connection string; `/health` is degraded if unset                  |
| `TEST_DATABASE_URL`                                                                                            | unset                    | Integration tests only; database name must end in `_test`                     |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_TEST_DB`, `POSTGRES_TEST_PORT` | see `.env.example`       | Read by `docker-compose.yml` only                                             |
| `ALLOWED_REPO_ROOTS`                                                                                           | empty (none allowed)     | Platform path delimiter (`;` on Windows)                                      |
| `REPO_REQUIRE_GIT_DIR`                                                                                         | `true`                   | Require a `.git` directory when registering a repository                      |
| `INFERENCE_BASE_URL`                                                                                           | `http://127.0.0.1:11434` | Local runtime; remote-endpoint rejection arrives in Stage 5                   |
| `EMBEDDING_MODEL`                                                                                              | unset                    | Stage 5                                                                       |
| `CHAT_MODEL`                                                                                                   | unset                    | Stage 5                                                                       |
| `EMBEDDING_DIMENSIONS`                                                                                         | `768`                    | Must match the `vector` column; changing it needs a migration and re-index    |
| `INGEST_MAX_FILE_BYTES`                                                                                        | `524288`                 | Larger files are skipped (`too-large`); at least 1024                         |
| `INGEST_MAX_TOTAL_BYTES`                                                                                       | `104857600`              | Total bytes indexed per repository; must be at least the file limit           |
| `INGEST_LANGUAGES`                                                                                             | unset (all known)        | Comma-separated language ids to index; an unknown id stops the API at startup |
| `INGEST_EXCLUDE_PATTERNS`                                                                                      | empty                    | Comma-separated `.gitignore` patterns added to the built-in exclusions        |
| `CHUNK_MAX_CHARS`                                                                                              | `2000`                   | Largest chunk in characters (200 to 20000)                                    |
| `CHUNK_OVERLAP_CHARS`                                                                                          | `200`                    | Overlap between windows of a split symbol; must be below `CHUNK_MAX_CHARS`    |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Private project. All rights reserved.
