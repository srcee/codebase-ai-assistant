# Improvement 006: Continuous dependency scanning

- **Status:** Open
- **Severity:** Medium
- **Area:** `.github/`, CI workflow
- **Target stage:** 10 (can start now)

## Problem

Stage 19 runs `npm audit` once. Nothing watches dependencies between stages, and pinned exact versions mean security fixes never arrive on their own.

## Proposed fix

- `.github/dependabot.yml` for `npm` and `github-actions`, weekly, grouped minor/patch updates; keeps exact pins.
- CI step: `npm audit --omit=dev --audit-level=high` (fail) and a non-blocking full audit.
- Optional: SBOM (`npm sbom --sbom-format cyclonedx`) attached to releases; license allowlist check.

## Tests

- CI fails on a known high-severity advisory (verify once with a throwaway branch).

## Related

- [010-commitlint.md](010-commitlint.md)
