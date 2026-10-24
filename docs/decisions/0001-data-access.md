# 0001: Data access with Drizzle ORM

Status: accepted (Stage 2)

## Context

The project needs migrations, `tsvector` full-text columns with GIN indexes, `vector(n)` columns with HNSW indexes, and room for raw SQL in hybrid retrieval queries. Prisma and Drizzle were compared on those points.

## Comparison

| Concern                          | Prisma                                                               | Drizzle                                                          |
| -------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `vector(n)` column               | `Unsupported("vector(768)")`; unusable in the typed client           | `vector('embedding', { dimensions })` built in                   |
| HNSW index with operator class   | Not expressible in the schema; hand-written SQL in the migration     | `index().using('hnsw', col.op('vector_cosine_ops'))`             |
| Generated `tsvector` + GIN index | `Unsupported("tsvector")` plus manual SQL; schema drifts from the DB | `customType` + `generatedAlwaysAs()` + `index().using('gin', …)` |
| Composite FKs and CHECK          | CHECK constraints not supported in the schema                        | `foreignKey()` and `check()`                                     |
| Migrations                       | Generated SQL; edits needed for anything above                       | Plain SQL files; custom migrations (`--custom`) for extensions   |
| Raw SQL                          | `$queryRaw`, untyped results                                         | `sql` template and `db.execute()`, composable with typed queries |
| Runtime                          | Query engine/generated client step                                   | Thin TypeScript layer over `pg`; no generate step for the client |

## Decision

Use Drizzle ORM with the `pg` driver and `drizzle-kit` for migrations.

- Schema lives in `libs/server/database/src/lib/schema/`; migrations in `libs/server/database/migrations/`.
- Migration `0000` enables the `vector` extension (custom SQL); `0001` creates the schema.
- Vector and hybrid retrieval queries (Stage 7) may use raw SQL through the `sql` template.
- The embedding dimension (768, `nomic-embed-text`) is a constant in the schema and in config (`EMBEDDING_DIMENSIONS`, default 768). `/health` reports `degraded` when the column dimension differs from config. Changing the model dimension needs a new migration and a re-index.
- The full-text column uses the `simple` configuration so identifiers and error strings are not stemmed. CamelCase splitting, if needed, belongs in Stage 7.

## Consequences

- Schema and migrations stay in sync for every index type this project needs.
- `drizzle-kit` is a dev dependency; the API bundle only needs `drizzle-orm` and `pg`.
- Drizzle is pre-1.0; versions are pinned to a minor range and migrations are plain SQL, so moving away later is cheap.
