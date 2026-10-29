# 0007: Local API authentication

Status: accepted (CAA-9)

## Context

The API binds to loopback, but indexed code and chat history are reachable by anything that can open a connection to that port: a web page in the user's browser (cross-site requests, DNS rebinding), another process, or another OS user on the machine. HTTPS does not help, because the traffic never leaves the host. The product is single-user, so accounts and roles would add cost without reducing a real risk.

## Decision

- **One per-install bearer token.** `ApiTokenService` reads `API_TOKEN_FILE` (default `.local/api-token.secret`) at startup, or creates it with 32 random bytes (base64url) using `wx` so an existing file is never overwritten. The file is `0600` in a `0700` folder. On POSIX the API refuses to start if group or others have any access; Windows reports synthetic modes, so the check is skipped there and the user profile ACLs apply. A malformed file stops startup with a message that names neither the path nor the content.
- **Constant-time check.** `ApiTokenGuard` compares SHA-256 digests with `timingSafeEqual`, so length and content do not leak through timing. A failure returns `401` with `WWW-Authenticate: Bearer` and a fixed message. The token is never logged.
- **Request origin check.** `LoopbackRequestGuard` runs first and returns `403` unless `Host` is `localhost`, `127.0.0.1`, or `[::1]` (any port), `Origin` is absent or one of those, and `Sec-Fetch-Site` is not `cross-site`. It logs a reason code only. Any port is accepted because the web dev server origin is not fixed; a page on another local port still needs the token. CORS stays disabled.
- **Open routes.** `@Public()` skips the token check, not the origin check. Only `GET /health/live` uses it; it answers `{ status: 'ok' }` and checks no dependency. `GET /health` keeps its response but is protected, because it reports the runtime, model availability, and schema state.
- **Loopback only.** `API_ALLOW_NON_LOOPBACK` is removed. Serving beyond the host would need TLS and a real identity model, which are out of scope for V1. The origin check would reject non-loopback hostnames anyway.
- **The web app never holds the token.** The Vite dev proxy reads the token file per request and sets the header, so the token stays out of the bundle and out of browser storage. How a built UI is served is decided in stage 9.
- **Rotation.** Delete the file and restart the API.

## Consequences

- Every test app uses a fixed test token (`TEST_API_TOKEN`) and never touches a token file; specs call the API through `authorizedAgent(app)`.
- Tools such as `curl` and Bruno need the token. The README and the Bruno collection document how.
- Out of scope: users, roles, TLS, token expiry, and rate limiting. Revisit if the API is ever served beyond loopback.
