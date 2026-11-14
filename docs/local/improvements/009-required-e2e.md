# Improvement 009: Make the e2e suite required

- **Status:** Open
- **Severity:** Medium
- **Area:** `apps/web`, new e2e project, CI
- **Target stage:** 9

## Problem

Stage 17 marks Playwright as optional. Without it, the privacy claim "the UI makes no external requests" and the safe-rendering rules are only checked by unit tests against mocked fetch.

## Proposed fix

- Add a Playwright e2e project (Nx) using a fixture repository and a fake inference server on loopback (`FakeLoopbackServer`).
- Flows: register, index, ask, open citation, delete.
- Fail the test on any request to a non-loopback host (route interception) and on any CSP violation.
- Run in CI with the test database service.

## Tests

- The suite itself; it must fail when a test page loads an external URL.

## Related

- [../security/004-security-headers-csp.md](../security/004-security-headers-csp.md)
- [../security/005-safe-rendering-of-model-output.md](../security/005-safe-rendering-of-model-output.md)
