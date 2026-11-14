# Stage 11 — Tables: CSV and XLSX

**Goal:** Index tabular documents, such as permission matrices, so that a question about one role or one row finds the row together with its column headers.

**Status:** Not started

**Prerequisites:** Stage 10.

## Tasks

1. Choose and pin libraries: a CSV parser and an XLSX reader (candidates `csv-parse`, `exceljs`). Check for network or telemetry behavior and record the choice in the stage notes.
2. Table chunker (shared with Markdown, HTML, DOCX, and PDF tables):
   - One chunk per row group within `CHUNK_MAX_CHARS`; every chunk repeats the header row.
   - Render rows as `Header: value` lines so the embedding sees the column meaning (for example `Role: Reviewer`, `Approve request: yes`).
   - Detect the header row (first non-empty row); merged or empty header cells get a positional name.
   - Wide tables: also emit one chunk per key column value when the first column looks like an entity (role, permission), so "what can the Reviewer do?" finds a single row.
   - `title` is `sheet > table`, locator `table_rows` with `rowStart`, `rowEnd`, and `columns`.
3. XLSX: one table per sheet (or per used range), formulas use cached values, hidden sheets are included and marked, cell count capped per sheet.
4. CSV: delimiter and encoding detection, quoted fields, size routing per decision 0011.
5. Eval: add permission-matrix questions (role to permission, permission to roles, "can role X do Y").

## Tests

- Header repeated in every chunk; row ranges in locators match the source.
- Role lookup question retrieves the right row in hybrid search.
- Malformed CSV and a corrupt XLSX fail that file only, with a reason code.
- Cell cap skips the rest of a sheet with a reason.

## Definition of Done

- A permission matrix in XLSX and CSV answers role and permission questions with row-level citations.
