# Stage 13 — HTML Exports (Confluence, Notion)

**Goal:** Index HTML exports of wiki and knowledge-base pages with heading-aware chunks and tables.

**Status:** Not started

**Prerequisites:** Stages 10 and 11.

## Tasks

1. Choose and pin an HTML parser (candidates `parse5`, `htmlparser2`). Parsing only: no script execution, no resource loading, no network.
2. Convert HTML to a heading tree: `h1`-`h6` give heading paths, the page `<title>` is the root.
3. Remove navigation, sidebars, breadcrumbs, and footers common to Confluence and Notion exports (selector list in a constants file).
4. Tables go to the table chunker; lists and code blocks stay intact within a chunk.
5. Links between exported pages are kept as text so the model sees page names; attachments in the export folder are indexed by their own format.
6. Exports usually arrive as a folder or a zip. Folder collections handle folders; zip upload is unpacked into the collection with the basic size limits.

## Tests

- Heading paths from nested headings; boilerplate removed.
- Confluence and Notion fixture exports (synthetic) produce the expected sections and tables.
- `<script>` content and inline event handlers never reach chunks.

## Definition of Done

- A synthetic Confluence space export answers questions with section citations.
