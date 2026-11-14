# Stage 12 — PDF

**Goal:** Index PDF documents with page and section citations.

**Status:** Not started

**Prerequisites:** Stages 10 and 11.

## Tasks

1. Choose and pin a PDF text extractor that runs in a worker without network access (candidates `unpdf`, `pdfjs-dist`). Disable any font or resource fetching.
2. Extract text per page with positions; rebuild reading order and paragraphs; drop repeated headers and footers (same text on most pages).
3. Detect headings from font size and weight where available; chunk by section like Markdown, with locator `section` and `page`, or `page` when no structure is found.
4. Tables: detect simple ruled or aligned tables and pass them to the table chunker; otherwise keep them as prose.
5. Pages with no text layer (scanned) are recorded with reason `no_text_layer`; Stage 16 can describe them once page rendering is available.
6. Page cap `PDF_MAX_PAGES` (basic limit); encrypted PDFs are skipped with a reason.

## Tests

- Page numbers in locators match the source; headers and footers removed.
- Section headings become heading paths.
- Encrypted, scanned, and over-cap PDFs are skipped or marked with reasons; a corrupt PDF fails that file only.

## Definition of Done

- A spec exported to PDF answers questions with page citations.
