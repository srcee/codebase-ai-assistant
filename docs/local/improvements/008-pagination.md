# Improvement 008: Pagination for list endpoints

- **Status:** Open
- **Severity:** Low
- **Area:** `apps/api` (codebases, indexing, chat), `libs/shared/contracts`
- **Target stage:** 8

## Problem

`GET /codebases` returns every row, and Stage 9 adds `GET /conversations` and conversation messages without limits. Long-lived installs accumulate conversations and jobs; unbounded lists slow the API and UI.

## Proposed fix

- Cursor pagination (`limit`, `cursor` based on `created_at` + `id`) with a max `limit` validated in the DTO.
- Shared `Page<T>` contract in `libs/shared/contracts`.
- Apply to conversations, messages, and any per-file job detail list; codebases can stay unpaged if a hard cap is documented.

## Tests

- Pages are stable and complete across inserts; `limit` above the max is rejected.

## Related

- [007-openapi.md](007-openapi.md)
