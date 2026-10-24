# server-database

PostgreSQL + pgvector access for the API, using Drizzle ORM. See `docs/decisions/0001-data-access.md`.

- `src/lib/schema/`: tables (one file each), constraints, and indexes.
- `src/lib/connection/`: `createDatabase()` and `runMigrations()`.
- `src/lib/nest/`: `DatabaseModule` / `DatabaseService` (NestJS connection and the `/health` check).
- `migrations/`: generated SQL (`npm run db:generate`); do not hand-edit applied files.

Integration tests need the test database (`npm run db:test:up`, `TEST_DATABASE_URL`) and are skipped without it. They drop the `public` schema, so the database name must end in `_test`.

Run `nx test server-database` to execute the tests.
