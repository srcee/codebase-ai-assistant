# Security 007: Ollama exposure is not documented

- **Status:** Open
- **Severity:** Medium
- **Area:** README / setup guide
- **Target stage:** 10

## Problem

The API enforces a loopback URL for inference, but Ollama itself has no authentication. If a user sets `OLLAMA_HOST=0.0.0.0` (common in guides for Docker or WSL), anyone on the network can use the models and send prompts. The API cannot detect this from the client side.

## Proposed fix

- Setup guide: keep Ollama bound to `127.0.0.1`; warn against `OLLAMA_HOST=0.0.0.0` and against publishing port 11434 from containers.
- Troubleshooting: how to check the bind address (`netstat -ano | findstr 11434` on Windows, `ss -ltnp` on Linux).
- Note that model pulls are the only expected network access from Ollama.

## Tests

- None (documentation).

## Related

- [002-non-loopback-without-tls-auth.md](002-non-loopback-without-tls-auth.md)
