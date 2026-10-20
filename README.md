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
cp .env.example .env   # optional; defaults are loopback-only
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

### Layout

- `apps/api`: NestJS API (global validation rejects unknown fields; unexpected errors return a generic 500).
- `apps/web`: React + Vite UI.
- `libs/shared/contracts`: DTO types shared with the frontend (`scope:shared`).
- `libs/server/config`: validated environment configuration (`scope:server`).

The web app cannot import `scope:server` libraries; this is enforced by lint.

### Environment variables

Configuration is validated at startup; invalid values stop the API. See [.env.example](.env.example).

| Variable                 | Default                  | Notes                                                       |
| ------------------------ | ------------------------ | ----------------------------------------------------------- |
| `API_HOST`               | `127.0.0.1`              | Non-loopback values are rejected unless opted in below      |
| `API_PORT`               | `3000`                   |                                                             |
| `API_ALLOW_NON_LOOPBACK` | `false`                  | Explicit opt-in to bind a non-loopback interface            |
| `DATABASE_URL`           | unset                    | Used from Stage 2                                           |
| `ALLOWED_REPO_ROOTS`     | empty (none allowed)     | Platform path delimiter (`;` on Windows)                    |
| `INFERENCE_BASE_URL`     | `http://127.0.0.1:11434` | Local runtime; remote-endpoint rejection arrives in Stage 5 |
| `EMBEDDING_MODEL`        | unset                    | Stage 5                                                     |
| `CHAT_MODEL`             | unset                    | Stage 5                                                     |
| `EMBEDDING_DIMENSIONS`   | unset                    | Stage 5                                                     |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Private project. All rights reserved.
