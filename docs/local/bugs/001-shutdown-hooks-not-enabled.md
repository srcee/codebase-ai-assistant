# Bug 001: Shutdown hooks are not enabled

- **Status:** Fixed (CAA-8)
- **Severity:** Medium
- **Area:** `apps/api/src/main.ts`
- **Target stage:** Hardening (any)

## Problem

`bootstrap()` in [main.ts](../../../apps/api/src/main.ts) never calls `app.enableShutdownHooks()`. Nest then ignores `SIGINT` and `SIGTERM`, so `OnApplicationShutdown` hooks do not run when the process stops:

- `IndexJobRunnerService` does not abort running jobs or in-flight embedding requests (decision 0006).
- `DatabaseService` does not close the `pg` pool.

Restart recovery hides the job side (orphaned jobs are marked failed on the next boot), but jobs keep writing until the process dies and connections are dropped instead of closed.

## Proposed fix

- Call `app.enableShutdownHooks()` in `bootstrap()` before `app.listen`.
- Keep the signal list default; no custom handlers.

## Tests

- Integration: start the app, start a job against a fake `EMBEDDING_PORT`, call `app.close()`, assert the job's abort signal fired and the pool ended.
- Unit: `bootstrap` enables shutdown hooks (spy on the Nest app).

## Related

- [improvements/004-index-job-time-limit.md](../improvements/004-index-job-time-limit.md)
