# Security 004: No security headers or Content Security Policy

- **Status:** Open
- **Severity:** Medium (High once the Stage 17 UI renders model output)
- **Area:** `apps/api` (`configure-app.ts`), `apps/web` (`index.html`, Vite config)
- **Target stage:** 19 (deferred with the other hardening; single local user until then)

## Problem

The API sends no security headers and the web app has no CSP. The UI will display model output that may be shaped by prompt injection in indexed source, so a missing CSP turns any rendering slip into script execution with access to the API.

## Proposed fix

- API: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: no-store` on data routes. Set them in a small middleware or add helmet (explain the dependency trade-off first).
- Web: strict CSP via the served HTML or dev server headers: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.
- No inline scripts or styles that would force `'unsafe-inline'`.

## Tests

- API responses carry the expected headers.
- Built web app serves the CSP; a Playwright check confirms no CSP violations on the main flows.

## Related

- [005-safe-rendering-of-model-output.md](005-safe-rendering-of-model-output.md)
- [001-host-origin-validation.md](001-host-origin-validation.md)
