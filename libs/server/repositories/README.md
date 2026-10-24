# server-repositories

Repository registration for the API: the path policy and the `/repositories` endpoints.

- `src/lib/path-policy/`: `PathPolicyService` resolves a requested path with `realpath`, requires it to sit inside `ALLOWED_REPO_ROOTS` (symlinks and junctions are resolved first), and rejects relative, traversal, UNC, device, and alternate-stream paths. `REPO_REQUIRE_GIT_DIR` controls the `.git` directory check.
- `src/lib/repositories.*`: controller, service, and module. Responses come from `toRepositoryResponse` and never include the absolute path.

Run `nx test server-repositories` to execute the unit tests. Endpoint integration tests live in `apps/api` and need `TEST_DATABASE_URL`.
