# Improvement 007: OpenAPI description

- **Status:** Open
- **Severity:** Low
- **Area:** `apps/api`, `libs/shared/contracts`, README, `bruno/`
- **Target stage:** Stage 18 (after Stage 16 when the API is complete)

## Problem

Endpoints are documented by hand in the README and the Bruno collection. They drift from the DTOs and contracts.

## Proposed fix

- Generate an OpenAPI document from the DTOs (`@nestjs/swagger`) or from contract schemas; explain the dependency trade-off first.
- Serve it only in development on loopback, or write it to a file at build time; no hosted Swagger UI assets from CDNs.
- README links to the generated file instead of listing endpoints.

## Tests

- Snapshot test of the generated document so contract changes show up in review.

## Related

- [008-pagination.md](008-pagination.md)
