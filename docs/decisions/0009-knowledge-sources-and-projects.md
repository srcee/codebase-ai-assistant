# 0009: Knowledge sources and projects

Status: accepted (Stage 8)

## Context

The assistant answers questions about code. The same engine (local inference, hybrid retrieval, index jobs, citations) should also answer questions about project documentation, such as "what permissions does the Reviewer role have?", from requirements, permission matrices, schemas, and design exports. Keeping both in one repository avoids two copies of the privacy, inference, and retrieval code, and lets one question span specs and code.

The current schema assumes code: `repositories` has `canonical_path` and `last_indexed_commit`, `code_chunks` requires `start_line` and `end_line`, and retrieval and citations are scoped by `repositoryIds`. Stage 9 (chat) persists citations, so the shape must be general before it starts.

## Decision

- **A source is anything that is indexed.** `repositories` becomes `sources` with `kind` (`code_repository` or `document_collection`, CHECK constraint). Code repositories keep their path policy and ingestion unchanged. Document collections get `origin` (`folder` or `upload`, see decision 0010).
- **Projects group sources.** `projects` (id, name, description, timestamps) and `project_sources` (project id, source id, unique pair) let one question span a code repository and its documentation. A source can belong to several projects. Deleting a project never deletes its sources.
- **One chunk table.** `code_chunks` becomes `chunks` and `repository_files` becomes `source_files`. `start_line` and `end_line` become nullable, `symbol_name` becomes `title`, and every chunk gets `content_kind` (`code`, `prose`, `table_rows`, `schema_entity`, `image_description`) and a `locator`.
- **Locator.** A `jsonb` column with a `kind` discriminator, validated with zod in the app and checked in SQL on `locator->>'kind'`:
  - `lines`: `startLine`, `endLine` (code, plain text).
  - `section`: `headingPath` (array), optional `page`.
  - `page`: `page`.
  - `table_rows`: optional `sheet`, `tableIndex`, `rowStart`, `rowEnd`, and the `columns` header.
  - `schema_entity`: `entity`, optional `path` (for example `paths./roles.get`).
  - `image`: optional `frame` or `region` label.
- **`title` carries the strongest search signal.** It holds the symbol name for code, the heading path for sections, the sheet and table name for tables, and the entity name for schemas. It keeps weight A in `search_vector`.
- **Scope is `sourceIds`.** Retrieval and chat take `sourceIds`, or a `projectId` that the server resolves to its sources. All filters stay in SQL. A request that names both is rejected, so a source outside the project can never be added to its scope.
- **Citations reference the locator.** A citation stores source id, file path, and locator, so it survives re-indexing and renders the same way for code and documents.
- **API.** `/codebases` stays for code repositories. `/document-collections` and `/projects` are added. Shared shapes go in `libs/shared/contracts`.
- **No remote connectors.** Documents come from local folders or uploads only. Figma, Confluence, Notion, and Jira are used through local exports. A remote connector would need an egress exception and its own decision.

## Consequences

- drizzle-kit 0.31 crashes when one generation renames a table and alters its columns. No index held data worth keeping yet, so the migrations were squashed into a new baseline (`0000_enable_vector_extension`, `0001_initial_schema`) instead of a rename migration. Existing local databases need `npm run db:reset` and a re-index.
- Code paths that used lines directly (context budget overlap, citation validation, eval scoring) work on the locator instead.
- Code chunks get `content_kind = 'code'`, the symbol name as `title`, and a `lines` locator; chunking output and `CHUNKING_VERSION` are unchanged.
- Code and documents share one embedding model and one vector space, so mixed-source questions rank in one list.
