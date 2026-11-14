# Improvement 010: Enforce Conventional Commits

- **Status:** Open
- **Severity:** Low
- **Area:** `.husky/`, `package.json`, CI
- **Target stage:** Any

## Problem

The contribution rules require Conventional Commits and `CAA-<ticket>-<summary>` branch names, but nothing checks them.

## Proposed fix

- `commitlint` with `@commitlint/config-conventional` in a `commit-msg` Husky hook (exact version pins).
- CI check on PR commits.
- Optional: branch name check in a `pre-push` hook.

## Tests

- A non-conforming message is rejected locally.

## Related

- [006-dependency-scanning.md](006-dependency-scanning.md)
