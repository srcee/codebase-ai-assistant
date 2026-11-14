# Stage 1 — Nx Workspace and Application Skeletons (M0)

**Goal:** A buildable, testable, lintable monorepo with an API and web skeleton and validated configuration.

**Status:** Done (initial commit, PR #3 for test factories and coverage gates)

**Prerequisites:** Stage 0.

## Tasks

1. Create the Nx workspace in the existing repo (TypeScript, npm, no Nx Cloud/telemetry — decline prompts to keep V1 offline-friendly).
2. Generate `apps/api` (NestJS) and `apps/web` (React + Vite + TypeScript).
3. Generate only the libraries needed now:
   - `libs/shared/contracts` — DTO types safe for the frontend.
   - `libs/server/config` — validated configuration.
     Do not create empty libraries for future modules.
4. Configuration (`libs/server/config`):
   - Schema-validated env (e.g. `zod`), fails closed on invalid values.
   - Initial keys: `API_HOST` (default `127.0.0.1`), `API_PORT`, `DATABASE_URL`, `ALLOWED_REPO_ROOTS`, `INFERENCE_BASE_URL`, `EMBEDDING_MODEL`, `CHAT_MODEL`, `EMBEDDING_DIMENSIONS`.
   - Commit `.env.example`; never `.env`.
5. API skeleton: bind to `127.0.0.1` by default, global validation pipe (whitelist + forbid unknown fields), `GET /health` (API only for now), sanitized exception filter, logger that never prints request bodies.
6. Web skeleton: Vite dev server proxying to the API; placeholder page that calls `/health`.
7. Tooling: ESLint with Nx module-boundary rules and tags (`scope:shared`, `scope:server`, `scope:web`; web must not import server libs), Prettier, Jest or Vitest, Supertest for API tests.
8. Husky + lint-staged pre-commit (lint/format) and a secret scanner hook.
9. CI-equivalent local scripts: `npm run lint`, `test`, `build` via `nx run-many`. Add a GitHub Actions workflow if a remote exists (lint, test, build only; no secrets).
10. Document dev commands in the README.

## Tests

- Config: invalid/missing values fail startup; default host is loopback.
- API e2e: `/health` returns 200; unknown body fields rejected.
- Lint rule check: a web import of a server lib fails lint.

## Definition of Done

- `nx run-many -t lint test build` passes.
- API and web run locally; web shows health status.
- README documents commands and environment variables.
