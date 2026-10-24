# 0003: Test data factories

Status: accepted (CAA-4)

## Context

Specs built mock data inline (hardcoded names, hashes, vectors) and repeated the same setup: test-database reset, Nest app construction, temporary repositories, canary strings. Shapes drifted between files.

## Decision

- Test data comes from [fishery](https://github.com/thoughtbot/fishery) factories with [@faker-js/faker](https://fakerjs.dev), both pinned and installed as devDependencies.
- Three test-only locations, because Nx forbids dependency cycles and the web app may import only shared code:
  - `libs/shared/testing` (`@codebase-ai/shared-testing`, `scope:shared`): factories for contract types, the `faker` instance, canary constants, `assertNotLeaked`.
  - `libs/server/testing` (`@codebase-ai/server-testing`, `scope:server`): sandbox with git repositories and junctions, `testConfig`.
  - `libs/server/database/src/testing` (`@codebase-ai/server-database/testing`): Drizzle row factories (`.create()` inserts through a `db` transient param), integration-database helpers (`describeWithDatabase`, `prepareDedicatedDatabase`, `resetSchema`). It lives inside `server-database` because a separate library would depend on it and be depended on by its specs.
  - `apps/api/src/testing`: `createTestApp`, which needs `AppModule` and cannot live in a library.
- ESLint allows importing these, `fishery`, and `@faker-js/*` only from spec files and `testing/` folders, so they never reach a production bundle. The testing folders are excluded from the app and library build configs and from coverage.
- Faker is unseeded. Specs assert on values returned by factories, never on literal faker output. Unique columns combine the factory sequence with faker values.
- Canary secrets stay fixed strings so a leak is easy to recognise.
- `@faker-js/faker` 10 is ESM-only. `jest.preset.js` lets ts-jest compile it (`tsconfig.jest-vendor.json`), and `@faker-js/faker/locale/en` keeps that to a few files. Vitest needs nothing.
- Jest `restoreMocks` and `clearMocks` and Vitest `restoreMocks`, `clearMocks`, and `unstubGlobals` are on by default, so specs do not restore mocks by hand.
- `npm run test:coverage` enforces per-project thresholds in CI. Plain `npm test` does not, so it works without a database.

## Consequences

- Adding a table or contract type means adding a factory next to it.
- A faker major upgrade needs a check of the Jest transform.
- The Windows CI job runs without Postgres, so database suites skip there; the Linux job covers them.
