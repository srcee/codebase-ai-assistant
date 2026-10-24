# Contributing

## Branches

- `main` must stay green (lint, test, build pass).
- Work on `stage-<N>/<topic>` branches, for example `stage-1/nx-workspace`.
- Merge to `main` via pull request or squash merge. One vertical slice per PR.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new behavior
- `fix:` bug fix
- `test:` tests only
- `docs:` documentation only
- `chore:` tooling, config, dependencies
- `refactor:` no behavior change

Example: `feat(repositories): reject symlinks escaping the allowed root`

## Rules

- Never commit `.env` files, keys, credentials, or real repository content. Commit `.env.example` only.
- Fixtures must be synthetic and free of real secrets.
- Build test data with the fishery factories and `faker` from the testing libraries; do not hand-write fixture objects in specs. Faker is unseeded, so assert on the values a factory returned, never on literal faker output.
- Do not log source code, embeddings, secrets, full prompts, or raw request payloads.
- Preserve the V1 local-only privacy invariant; no hosted AI providers or telemetry.
- Add tests for security and privacy behavior alongside the feature.
