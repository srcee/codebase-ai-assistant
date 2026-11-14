# Stage 15 — Schemas: OpenAPI, JSON Schema, SQL DDL, GraphQL

**Goal:** Index API and data schemas with one chunk per entity, so questions about an endpoint, field, or table find the exact definition.

**Status:** Not started

**Prerequisites:** Stage 10.

## Tasks

1. Format detection: OpenAPI (JSON or YAML with `openapi` or `swagger`), JSON Schema (`$schema` or `definitions`/`$defs`), SQL DDL (`.sql` with `create table`), GraphQL SDL (`.graphql`, `.gql`). Pin parsers as needed (candidates `yaml`, `graphql`); SQL DDL uses a small statement splitter unless a parser is clearly needed.
2. Chunking, locator `schema_entity`, `title` is the entity name:
   - OpenAPI: one chunk per operation (method, path, summary, parameters, request and response schemas with resolved local `$ref` names, security requirements and scopes), one per component schema.
   - JSON Schema: one chunk per definition with required fields and enums.
   - SQL: one chunk per table, view, or type, including constraints and comments.
   - GraphQL: one chunk per type, with field arguments and directives.
3. Only local `$ref` is resolved; remote refs are listed as text, never fetched.
4. Search terms include entity, field, and enum names split like code identifiers.
5. Eval: questions such as "which endpoints require scope X?" and "which fields does Role have?".

## Tests

- Entity chunks and paths for each format from synthetic fixtures.
- Remote `$ref` is never fetched (outbound audit).
- Large specs route to the worker pool.

## Definition of Done

- An OpenAPI spec and a SQL schema answer endpoint, permission, and field questions with entity citations.
