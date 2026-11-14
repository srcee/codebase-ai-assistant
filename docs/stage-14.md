# Stage 14 — DOCX

**Goal:** Index Word documents with headings and tables.

**Status:** Not started

**Prerequisites:** Stages 11 and 13.

## Tasks

1. Choose and pin a DOCX converter (candidate `mammoth`), converting to HTML in a worker and reusing the Stage 13 HTML pipeline.
2. Map Word heading styles to headings; tables go to the table chunker.
3. Keep comments and tracked changes out by default; record that choice in the stage notes.
4. Embedded images are extracted and indexed through Stage 16 once it exists; until then they are counted and skipped with a reason.
5. Basic limits: compressed and uncompressed size per file.

## Tests

- Heading paths and table rows from a synthetic DOCX fixture.
- A corrupt DOCX fails that file only.

## Definition of Done

- A requirements document in DOCX answers questions with section citations.
