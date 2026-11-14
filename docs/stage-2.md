# Stage 2 — Database, pgvector, and Schema

**Goal:** Local PostgreSQL with pgvector, chosen data-access approach, migrations, and the initial schema.

**Status:** Done (CAA-2, PR #1)

**Prerequisites:** Stage 1.

## Tasks

1. `docker-compose.yml` with `pgvector/pgvector` image:
   - Port bound to `127.0.0.1` only.
   - Named volume for data.
   - Credentials from `.env`, not hardcoded.
   - A separate test database (or a second compose profile) for integration tests.
2. **ORM spike (time-boxed):** compare Prisma vs Drizzle on migrations, `tsvector` full-text columns/GIN indexes, `vector` columns and HNSW/IVFFlat indexes, and raw SQL ergonomics. Record the decision in `docs/decisions/0001-data-access.md`. Raw SQL is acceptable for vector and hybrid queries.
3. Create `libs/server/database` with the chosen tool, migrations, and a connection module for NestJS.
4. Initial migration (enable `vector` extension and create):
   - `repositories`, `repository_files`, `code_chunks`, `index_jobs`.
   - Conversation tables (`conversations`, `messages`, `message_citations`) may be added in Stage 9 to avoid unused schema.
5. Constraints and indexes:
   - Unique `(repository_id, relative_path)`.
   - Foreign keys with `ON DELETE CASCADE` from repository to files to chunks.
   - Index on chunk hash; generated `tsvector` column with GIN index; vector column with `EMBEDDING_DIMENSIONS` from config plus an HNSW index (consider deferring the vector index until Stage 7 benchmarks).
   - Store `embedding_model` and `chunking_version` per chunk.
6. Extend `/health` with a database check (connectivity and `vector` extension present).
7. Document: start/stop DB, run migrations, reset local data.

## Tests

- Integration (against the test DB): migrations apply cleanly on an empty DB and are repeatable.
- Cascade delete removes files and chunks.
- Unique constraint on relative paths enforced.
- Inserting a vector with the wrong dimension fails.

## Definition of Done

- `docker compose up -d` plus migration command yields a ready DB.
- Integration tests pass; decision record committed.
