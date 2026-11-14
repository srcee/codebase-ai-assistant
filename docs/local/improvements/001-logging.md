# Improvement 001: Logging

- **Status:** Fixed (CAA-10); no audit line for conversations yet because chat does not exist
- **Severity:** Medium
- **Area:** `apps/api` (`main.ts`, new interceptor/middleware), `libs/server/config`
- **Target stage:** Hardening (any)

## Problem

Logging uses the default Nest `Logger` with levels hardcoded in [main.ts](../../../apps/api/src/main.ts) (`['log', 'warn', 'error']`). There is:

- no way to change the level without a code change;
- no request ID to correlate log lines and error responses;
- no per-request line (method, route, status, duration);
- no record of state-changing actions (repository registered/deleted, index started/finished, conversation deleted).

## Proposed fix

- `LOG_LEVEL` in the config schema (`error | warn | log | debug | verbose`, default `log`), mapped to Nest logger levels.
- Request ID middleware using `AsyncLocalStorage`; accept no client-supplied ID, generate one per request, return it in an `X-Request-Id` header and in sanitized error bodies.
- Request logging interceptor: method, route template (not the raw URL), status, duration, request ID. Never bodies, query strings, or headers.
- One audit-style log line per mutation with resource IDs only.
- Optional `LOG_FORMAT=json` for structured output to stdout. No log shipping or remote sinks.

## Tests

- Invalid `LOG_LEVEL` fails startup.
- Request log line contains the route template and request ID, never the body (canary assertion).
- Error response includes the same request ID as the log line.

## Related

- [../security/006-chat-stream-abort-and-limits.md](../security/006-chat-stream-abort-and-limits.md)
