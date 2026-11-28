# 0016: Containerized local stack

Status: accepted

## Context

Trying the project took a dozen steps: install dependencies, write `.env`, start Postgres, migrate, run the API and the web server in two terminals, and list allowed roots. The privacy rules make a plain Docker setup impossible: the API must bind to a loopback address (decision 0007), and `INFERENCE_BASE_URL` must be `localhost`, `127.0.0.1`, or `::1` (decision 0005), so `http://ollama:11434` or a published API port would be rejected. Container paths also differ from host paths, so users could not paste the folder paths they know, and an empty `ALLOWED_REPO_ROOTS` meant nothing could be registered.

## Decision

- **One command.** `npm start` runs `scripts/app.mjs` (Node built-ins only, so no `npm ci` first). It checks Docker and Ollama, fails with the exact `ollama pull` command when a model is missing, creates `.env` from `.env.example` with a random database password, and runs `docker compose --profile app up -d --build --wait`. `npm stop` and `npm run logs` wrap `down` and `logs`.
- **Ollama stays on the host.** Users install it and pull models themselves; Docker on macOS cannot use the GPU, and models are large.
- **One shared network namespace.** `web` (nginx), `api`, and `ollama-relay` use `network_mode: service:web`. The API binds to `127.0.0.1:3000` and reaches inference on `127.0.0.1:11434` exactly as on bare metal; no privacy check is relaxed. Only `web` publishes a port, on `127.0.0.1:${WEB_PORT}`.
- **Relay to host Ollama.** `ollama-relay` (`alpine/socat`, pinned) listens on loopback port 11434 and forwards to `host.docker.internal:11434`. The API cannot tell it from a local runtime; the relay only reaches the same machine.
- **Token stays server-side.** The API creates its `0600` token file on a shared volume. nginx runs as the same uid (1000), waits for the file, and adds `Authorization: Bearer` to `/api/` requests, replacing any header the browser sent, like the Vite dev proxy. `Host` and `Origin` pass through unchanged, so the DNS-rebinding guard still applies.
- **Migrations** run in a one-shot `migrate` service (`drizzle-kit migrate`) that the API waits for.
- **Images** come from `docker/Dockerfile` (targets `migrate`, `api`, `web`); `.dockerignore` keeps `.env`, `.local`, and `.git` out of the build context.
- **Home directory by default.** Empty `ALLOWED_REPO_ROOTS` and `ALLOWED_DOCUMENT_ROOTS` mean the user's home directory, natively and in Docker, where `SOURCES_DIR` (default: home) is mounted read-only at `/sources`.
- **Host path mapping.** `HOST_PATH_PREFIX` and `CONTAINER_PATH_PREFIX` (set together) let `PathPolicyService` rewrite a pasted host path such as `C:\Users\me\repo` to `/sources/repo` before every existing check. Windows prefixes compare case- and separator-insensitively on whole segments. A Windows path outside the prefix is reported as outside the allowed roots. Responses were already relative to the root, so nothing maps back.

## Alternatives

- **Ollama in a container**: self-contained, but CPU-only on macOS and a multi-gigabyte download hidden in the first run.
- **Only Postgres in Docker, API and web native**: no path mapping or relay needed, but needs `npm ci` and two long-running processes.
- **Service-name networking with a relaxed URL policy**: simpler compose file, but weakens the loopback guarantee that the privacy model rests on.

## Consequences

- The home directory (or `SOURCES_DIR`) is readable by the API container. It is mounted read-only and the path policy, secret-file exclusions, and `.gitignore` rules still decide what is indexed.
- On Linux, host Ollama must listen beyond loopback (`OLLAMA_HOST=0.0.0.0`) for the relay to reach it; the README says to keep port 11434 firewalled.
- Restarting `web` alone breaks the namespace the others joined; `npm start` recreates them. A rotated token needs a `web` restart.
- The Docker stack and `npm run db:up` share the `postgres` service and its data.
