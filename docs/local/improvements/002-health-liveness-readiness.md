# Improvement 002: Split health into liveness and readiness

- **Status:** Partly done (CAA-9): `GET /health/live` exists; `/health` stays as the protected readiness route and is not split further
- **Severity:** Low
- **Area:** `apps/api/src/app/modules/health`, `libs/shared/contracts`, `apps/web`
- **Target stage:** Hardening (any)

## Problem

`GET /health` answers both "is the process up" and "are the database and inference ready" in one response, returning 503 when any dependency is down. A supervisor or the UI cannot tell a dead API from a degraded one without parsing the body. It is also the only route that must stay open once [authentication](../security/003-local-api-token-auth.md) lands, yet it reveals dependency details.

## Proposed fix

- `GET /health/live`: 200 with `{ status: 'ok' }`, no dependency checks, unauthenticated.
- `GET /health/ready`: current checks (database, vector extension, dimensions, inference, models), behind authentication.
- Keep `GET /health` as an alias of `/health/ready` until the web app and Bruno collection are updated, then remove it.
- Update contracts, the web status component, and `bruno/health/`.

## Tests

- Liveness returns 200 with the database and inference down.
- Readiness returns 503 with the same dependency matrix as today.

## Related

- [../security/003-local-api-token-auth.md](../security/003-local-api-token-auth.md)
