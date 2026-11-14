# Improvement 004: Index job time limit

- **Status:** Open
- **Severity:** Low
- **Area:** `apps/api/src/app/modules/indexing/services/index-job-runner.service.ts`, `libs/server/config`
- **Target stage:** 6 follow-up

## Problem

Each inference request has `INFERENCE_TIMEOUT_MS`, but a whole job has no wall-time limit. A very large repository or a slow runtime keeps a job `running` for hours, blocking re-index of that repository (one active job per repository).

## Proposed fix

- `INDEXING_JOB_TIMEOUT_MS` in config (generous default, for example 2 hours).
- The runner aborts the job's `AbortController` when the limit passes and finishes the job as `failed` with a fixed summary ("Timed out").
- Optional: `POST /codebases/:id/index-jobs/latest/cancel` to cancel by hand, reusing the same abort path.

## Tests

- Fake timers: a job past the limit is aborted and marked failed; the next index request is accepted.

## Related

- [../bugs/001-shutdown-hooks-not-enabled.md](../bugs/001-shutdown-hooks-not-enabled.md)
- [003-database-pool-and-statement-timeout.md](003-database-pool-and-statement-timeout.md)
