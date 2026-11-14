# Stage 8 — Knowledge Sources and Projects

**Goal:** Generalize the data model and retrieval from code repositories to knowledge sources grouped by projects, so documentation can be indexed next to code and chat citations work for both.

**Status:** In progress (eval comparison with the Stage 7 report pending)

**Prerequisites:** Stage 7.

**Decision:** [0009 Knowledge sources and projects](decisions/0009-knowledge-sources-and-projects.md)

## Tasks

1. Schema and migration (the old migrations are replaced by a new baseline, see decision 0009; local databases need `npm run db:reset`):
   - Rename `repositories` to `sources`; add `kind` (`code_repository`, `document_collection`) and nullable `origin` (`folder`, `upload`, required for document collections), both with CHECK constraints. Existing rows become `code_repository`.
   - Rename `repository_files` to `source_files` and `code_chunks` to `chunks`; rename `repository_id` columns to `source_id`.
   - In `chunks`: `start_line` and `end_line` nullable, `symbol_name` renamed to `title`, add `content_kind` (CHECK) and `locator jsonb not null` (CHECK on `locator->>'kind'`).
   - Add `projects` and `project_sources` (unique pair, cascade on both sides, deleting a project keeps its sources).
   - Review the generated SQL: `search_vector` from `title`, its GIN index, and the HNSW index.
2. Locator types and zod schemas in the API (`types/`, `utils/`), shared display shape in `libs/shared/contracts`.
3. Update ingestion and indexing to write `title`, `content_kind`, and `locator` for code. Code chunking output and `CHUNKING_VERSION` stay the same.
4. Retrieval:
   - `RetrievalRequest` takes `sourceIds`; both searches filter `source_id` in SQL.
   - Context budget overlap uses the locator (same file and overlapping lines, section, or row range).
   - Results carry source kind, file path, title, and locator.
5. Create the `projects` feature module: `POST /projects`, `GET /projects`, `GET /projects/:id`, `PATCH /projects/:id` (name, description), `DELETE /projects/:id`, `PUT /projects/:id/sources` (replace the set). Unknown source ids are rejected.
6. `POST /search` accepts `sourceIds` or `projectId`. The server resolves the project to its sources. Sending both, or a source outside the project, is rejected.
7. Keep `/codebases` endpoints and responses. Update Bruno requests, contracts, factories, and the eval harness (score by locator).
8. Update decisions 0006 and 0008 where they name renamed tables or columns.

## Tests

- Migrations apply on an empty database; lexical and vector search work on the new schema.
- Locator CHECK rejects unknown kinds; zod rejects malformed locators.
- Scope isolation: a project with source A never returns chunks of source B, including when B shares a project with A elsewhere.
- Project resolution: empty project returns nothing; deleting a project keeps sources and chunks; deleting a source removes it from projects.
- Eval report on the existing corpus matches the Stage 7 final report within noise.

## Definition of Done

- Code indexing, retrieval, and eval work as before on the renamed schema.
- Projects can group sources and scope search.
