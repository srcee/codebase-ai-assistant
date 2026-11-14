# Stage 0 — Git and Project Governance

**Goal:** Put the repository under version control with safe defaults before any code exists.

**Status:** Done (initial commit)

**Prerequisites:** Git installed; GitHub (or other) account if a remote is wanted. Node 22 and Docker are already available; Ollama is not installed yet (needed in Stage 5).

## Tasks

1. `git init -b main` in the repository root.
2. Add `.gitignore` covering: `node_modules`, `dist`, `.nx/cache`, `coverage`, `.env*` (but keep `.env.example`), `*.pem`, `*.key`, local data dirs (`.data/`, `pgdata/`), IDE-local files, OS files.
3. Add `.gitattributes` (`* text=auto eol=lf`) to avoid Windows/Linux line-ending churn.
4. Add `.editorconfig` (UTF-8, LF, 2-space indent, final newline).
5. Add a minimal `README.md` (purpose, privacy invariant, status, link to `docs/`).
6. Add `LICENSE` or an explicit "private / all rights reserved" note.
7. Define conventions in `CONTRIBUTING.md` or the README:
   - Branches: `main` stays green; work on `stage-N/<topic>` branches, merged via PR (or squash locally).
   - Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
   - One vertical slice per PR.
8. Create the remote repository (private) and push `main`, if desired.
9. Set up secret-leak protection from the start: pre-commit hook (e.g. `gitleaks` or `husky` + lint-staged added in Stage 1). Never commit real credentials or real repository content.
10. Initial commit: docs + the files above.

## Plan review notes (decisions carried into later stages)

- **Ordering change:** database comes before repository registration (metadata is stored in PostgreSQL), and the privacy/egress policy plus local inference adapters come **before** embeddings/indexing instead of at the end (original M5). The final privacy stage then only verifies and hardens.
- **Ollama is not installed**; Stage 5 starts with installing it and pulling models.
- Open decisions from section 18 of the project context are assigned to stages: ORM spike (Stage 2), models and dimensions (Stage 5), limits and extensions (Stage 4), conversation retention (Stage 9).
- Stage 1 uses Nx; Prisma-vs-Drizzle must not leak into shared contracts.

## Definition of Done

- `git log` shows a clean initial commit; `git status` is clean.
- `.gitignore` prevents committing `.env`, keys, build output, and caches (verify by creating dummy files).
- Branch and commit conventions are documented.
