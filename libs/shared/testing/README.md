# shared-testing

Test-only helpers shared by the API and the web app: fishery factories for the shared contracts, a `faker` instance, and canary secrets.

- Import it only from `*.spec.*` files and `src/testing/**`; ESLint enforces this.
- Faker is not seeded. Assert on the values a factory returned, never on literal faker output.
- Canary secrets are fixed strings on purpose, so a leak is easy to spot. Use `assertNotLeaked` to check output.
