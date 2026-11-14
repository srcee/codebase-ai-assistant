# Local items

Progress overview. Each item file has the details; update the checkbox when its status changes.

## Bugs

- [x] [001 Shutdown hooks are not enabled](bugs/001-shutdown-hooks-not-enabled.md): fixed in CAA-8

## Security

- [x] [001 Host/Origin validation](security/001-host-origin-validation.md): fixed in CAA-9
- [x] [002 Non-loopback without TLS or auth](security/002-non-loopback-without-tls-auth.md): fixed in CAA-9 (flag removed)
- [x] [003 Local API token authentication](security/003-local-api-token-auth.md): fixed in CAA-9
- [ ] [004 Security headers and CSP](security/004-security-headers-csp.md): Stage 19
- [ ] [005 Safe rendering of model output](security/005-safe-rendering-of-model-output.md): Stage 17
- [ ] [006 Chat stream abort and limits](security/006-chat-stream-abort-and-limits.md): Stage 9
- [ ] [007 Ollama exposure](security/007-ollama-exposure.md): Stage 19
- [ ] [008 Data at rest and deletion](security/008-data-at-rest-and-deletion.md): Stage 19

## Improvements

- [x] [001 Logging](improvements/001-logging.md): fixed in CAA-10
- [~] [002 Health liveness and readiness](improvements/002-health-liveness-readiness.md): partly done, `/health/live` exists
- [x] [003 Database pool and statement timeout](improvements/003-database-pool-and-statement-timeout.md): Stage 7
- [ ] [004 Index job time limit](improvements/004-index-job-time-limit.md): Stage 18
- [ ] [005 Chat retention and backups](improvements/005-chat-retention-and-backups.md): Stage 9
- [ ] [006 Dependency scanning](improvements/006-dependency-scanning.md): Stage 19
- [ ] [007 OpenAPI](improvements/007-openapi.md): Stage 18
- [ ] [008 Pagination](improvements/008-pagination.md): Stage 9
- [ ] [009 Required e2e suite](improvements/009-required-e2e.md): Stage 17
- [ ] [010 Commitlint](improvements/010-commitlint.md)
