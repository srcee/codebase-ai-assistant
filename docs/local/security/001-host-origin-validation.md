# Security 001: No Host/Origin check on the loopback API (DNS rebinding)

- **Status:** Fixed (CAA-9, decision 0007)
- **Severity:** High (exposure of indexed code and chat history)
- **Area:** `apps/api` (`configure-app.ts`)
- **Target stage:** 10 (earlier preferred)

## Problem

The API binds to loopback by default but does not validate the `Host` or `Origin` headers. A malicious web page open in the user's browser can:

- send simple cross-site requests (CSRF-style) to `http://127.0.0.1:<port>`;
- use DNS rebinding (an attacker domain re-resolved to 127.0.0.1) to make those requests same-origin and read the responses, exposing repository chunks and chat history.

HTTPS does not mitigate this.

## Proposed fix

- Add a middleware in `configureApp` that rejects requests whose `Host` is not `localhost`, `127.0.0.1` or `[::1]` with the configured API port.
- Reject requests that carry an `Origin` header not in the same allowlist (the web dev server origin included).
- Keep CORS disabled.

## Tests

- Foreign `Host` is rejected.
- Foreign `Origin` is rejected.
- Allowed values pass.

## Related

- [003-local-api-token-auth.md](003-local-api-token-auth.md)
- [004-security-headers-csp.md](004-security-headers-csp.md)
