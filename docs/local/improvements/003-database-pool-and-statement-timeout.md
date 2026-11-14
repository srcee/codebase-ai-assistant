# Improvement 003: Database pool and statement timeout

- **Status:** Done (Stage 7)
- **Severity:** Medium
- **Area:** `libs/server/database/src/lib/connection/create-database.ts`, `libs/server/config`
- **Target stage:** 6 follow-up / 7

## Problem

[create-database.ts](../../../libs/server/database/src/lib/connection/create-database.ts) only sets `connectionTimeoutMillis`. The pool uses the `pg` defaults (`max` 10, default idle timeout) and there is no `statement_timeout`. A slow hybrid query (Stage 7) or a stuck transaction can hold a connection indefinitely, and indexing concurrency plus chat can exhaust the pool.

## Proposed fix

- Config: `DATABASE_POOL_MAX` (default 10), `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_STATEMENT_TIMEOUT_MS` (for example 30000), validated by zod.
- Pass `max`, `idleTimeoutMillis`, and `statement_timeout` to `pg.Pool`.
- Keep `INDEXING_EMBED_CONCURRENCY` max below `DATABASE_POOL_MAX` (config cross-check).
- Map statement timeout errors to a sanitized 503/504 without the SQL text.

## Tests

- Config validation for the new variables and the cross-check.
- Integration: a `pg_sleep` query beyond the timeout fails with the mapped error.

## Related

- [004-index-job-time-limit.md](004-index-job-time-limit.md)
