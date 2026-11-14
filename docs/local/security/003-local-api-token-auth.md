# Security 003: The local API has no authentication

- **Status:** Fixed (CAA-9, decision 0007); token file is `.local/api-token.secret` instead of an OS config folder
- **Severity:** High (any local process or OS user can read indexed code and chats)
- **Area:** `apps/api` (`configure-app.ts`, new guard), `apps/web` (API client), `libs/server/config`
- **Target stage:** 10 (before Stage 9 UI preferred)

## Problem

The API trusts every request that reaches the loopback port. [Security 001](001-host-origin-validation.md) stops browser-based attacks, but other processes and other OS users on the same machine can still call `127.0.0.1:<port>` and read repository chunks, chat history, and trigger indexing.

Full user accounts, roles, or multi-user authorization are out of scope: the product is a single-user local tool.

## Proposed fix

- On first start, generate a random token (32 bytes, `crypto.randomBytes`) and store it in a file outside the repository with owner-only permissions (for example under the OS user config dir). Allow overriding the path through config.
- A global guard requires `Authorization: Bearer <token>` on every route except `GET /health/live`. Compare with `timingSafeEqual`.
- The web dev server reads the token at startup and injects it through the Vite proxy, so the token never ships in the bundle.
- Reject requests with `Sec-Fetch-Site: cross-site`.
- Never log the token; error responses do not say which part failed.
- Record the design as decision 0007 when implemented.

## Tests

- Missing, wrong, or malformed token returns 401 with a fixed message.
- Correct token passes; liveness stays open.
- Token file is created with restrictive permissions and reused across restarts.
- Token never appears in logs (canary assertion).

## Related

- [002-non-loopback-without-tls-auth.md](002-non-loopback-without-tls-auth.md)
- [../improvements/002-health-liveness-readiness.md](../improvements/002-health-liveness-readiness.md)
