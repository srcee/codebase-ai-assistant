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

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `npm run lint`    | ESLint, including Nx module-boundary rules           |
| `npm run test`    | Unit and API tests (Jest for server, Vitest for web) |
| `npm run build`   | Build all projects                                   |
| `npm run check`   | Lint, test, and build                                |
| `npm run format`  | Prettier                                             |
| `npm run secrets` | Secret scan of the working tree (secretlint)         |

A pre-commit hook runs the secret scan and Prettier on staged files.

### Database

PostgreSQL with pgvector runs in Docker (`docker-compose.yml`), bound to `127.0.0.1`, with data in the named volume `pgdata` and credentials from `.env`.

| Command                                       | Purpose                                                           |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `npm run db:up` / `npm run db:down`           | Start / stop the dev database (data is kept)                      |
| `npm run db:migrate`                          | Apply migrations (repeatable)                                     |
| `npm run db:generate`                         | Generate a migration after editing `schema.ts`                    |
| `npm run db:reset`                            | Delete all local data, then start and migrate a fresh database    |
| `npm run db:test:up` / `npm run db:test:down` | Start / remove the throwaway test database (port 5433, in memory) |

Integration tests use `TEST_DATABASE_URL` and are skipped when it is unset. They drop the `public` schema, so the database name must end in `_test`. `GET /health` returns 503 with `status: "degraded"` when the database is unreachable, the `vector` extension is missing, the schema is not migrated, or the embedding column dimension differs from `EMBEDDING_DIMENSIONS`.

### Layout

- `apps/api`: NestJS API (global validation rejects unknown fields; unexpected errors return a generic 500).
- `apps/web`: React + Vite UI.
- `libs/shared/contracts`: DTO types shared with the frontend (`scope:shared`).
- `libs/server/config`: validated environment configuration (`scope:server`).
- `libs/server/database`: Drizzle schema, migrations, and the NestJS connection module (`scope:server`).

The web app cannot import `scope:server` libraries; this is enforced by lint.

### Environment variables

Configuration is validated at startup; invalid values stop the API. See [.env.example](.env.example).

| Variable                                                                                                       | Default                  | Notes                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `API_HOST`                                                                                                     | `127.0.0.1`              | Non-loopback values are rejected unless opted in below                     |
| `API_PORT`                                                                                                     | `3000`                   |                                                                            |
| `API_ALLOW_NON_LOOPBACK`                                                                                       | `false`                  | Explicit opt-in to bind a non-loopback interface                           |
| `DATABASE_URL`                                                                                                 | unset                    | PostgreSQL connection string; `/health` is degraded if unset               |
| `TEST_DATABASE_URL`                                                                                            | unset                    | Integration tests only; database name must end in `_test`                  |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_TEST_DB`, `POSTGRES_TEST_PORT` | see `.env.example`       | Read by `docker-compose.yml` only                                          |
| `ALLOWED_REPO_ROOTS`                                                                                           | empty (none allowed)     | Platform path delimiter (`;` on Windows)                                   |
| `INFERENCE_BASE_URL`                                                                                           | `http://127.0.0.1:11434` | Local runtime; remote-endpoint rejection arrives in Stage 5                |
| `EMBEDDING_MODEL`                                                                                              | unset                    | Stage 5                                                                    |
| `CHAT_MODEL`                                                                                                   | unset                    | Stage 5                                                                    |
| `EMBEDDING_DIMENSIONS`                                                                                         | `768`                    | Must match the `vector` column; changing it needs a migration and re-index |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Private project. All rights reserved.
