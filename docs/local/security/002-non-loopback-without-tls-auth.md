# Security 002: `API_ALLOW_NON_LOOPBACK` exposes the API without TLS or authentication

- **Status:** Fixed (CAA-9): option 1, the flag is removed
- **Severity:** High when enabled; none in the default setup
- **Area:** `apps/api/src/main.ts`, `libs/server/config`
- **Target stage:** 10

## Problem

With `API_ALLOW_NON_LOOPBACK=true`, the API only logs a warning and serves plain HTTP with no authentication. Code chunks, prompts and answers then cross the network in cleartext, and anyone who can reach the port can query indexed repositories.

In the default loopback-only setup, HTTPS is not needed: traffic never leaves the host, and browsers treat `http://localhost` as a secure context.

## Proposed fix

Pick one:

1. Remove the flag and stay loopback-only, in line with the project scope (no hosted or multi-user deployment).
2. Keep the flag but require protection when it is set:
   - TLS terminated by a reverse proxy (Caddy, nginx, Traefik) or Nest `httpsOptions`;
   - authentication at the proxy or through a Nest guard (see [003](003-local-api-token-auth.md));
   - failing startup instead of only warning, unless the protection is configured.

Record the choice in `docs/decisions/` and update the README env table.

## Out of scope

API to Ollama egress stays plain HTTP on loopback by design (see decision 0005).

## Tests

- Option 1: config rejects `API_ALLOW_NON_LOOPBACK`.
- Option 2: startup fails when the flag is set without TLS and auth configured.

## Related

- [001-host-origin-validation.md](001-host-origin-validation.md)
- [003-local-api-token-auth.md](003-local-api-token-auth.md)
