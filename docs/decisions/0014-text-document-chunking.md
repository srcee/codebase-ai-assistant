# 0014: Text document chunking

Status: accepted (Stage 10)

## Context

Stage 10 indexes Markdown and plain text from document collections. Questions about documentation name sections ("the Reviewer permissions") and table rows ("can a Support Agent publish?"), so chunks must follow headings and tables, and their locators must cite them. Later stages (tables, PDF, HTML, DOCX) reuse the format registry, the table chunker, and the section rules, so the choices are recorded once here.

## Decision

- **Formats by extension.** `DOCUMENT_FORMATS` maps `.md` and `.markdown` to `markdown` and `.txt` to `text`; any other extension is skipped as `unsupported-extension`. Bytes that start with a known binary signature (PDF, ZIP, PNG, JPEG, GIF, OLE) or contain a NUL byte are skipped as `binary`; text is decoded as strict UTF-8 (`invalid-encoding` otherwise) and passes the same secret scan as code (`secret-content`).
- **Parser.** Markdown is parsed with `markdown-it` 15, pinned, MIT, with its own types and no network code. Raw HTML stays text and linkify is off; only the block structure (headings, tables, line maps) is used, and chunk content is the Markdown source, not rendered HTML.
- **Sections.** A heading stack (ATX and setext) gives the `headingPath`; each section's own text, up to the next heading of any level, is chunked, so a window never crosses a heading. A section chunk starts with its heading path line (`Roles > Reviewer`), so the embedding and the prompt see it; the same path is the `title` (search weight A) and the locator is `section`. Heading segments are cut at 200 characters, an empty heading is `(untitled)`, and the title is cut at a quarter of `CHUNK_MAX_CHARS`.
- **Text outside sections.** Front matter is kept as raw text in the first chunk. It, text before the first heading, and plain text files get a `lines` locator and no title.
- **Windows.** Blocks (paragraphs, lists, code fences) are packed into `CHUNK_MAX_CHARS` with `CHUNK_OVERLAP_CHARS` of overlap, at most half a window. A block that does not fit is split into lines, then sentences, words, and code points, so a long single-line paragraph is kept instead of being skipped as code ingestion does.
- **Tables** (shared with Stage 11). A GFM pipe table becomes `table_rows` chunks: every row is written as `Header: value` lines, rows are grouped within `CHUNK_MAX_CHARS`, and the title is the heading path of the section. The locator has the 1-based `tableIndex` within the document, `rowStart` and `rowEnd` counting the header as row 1 (as a spreadsheet does), and the `columns`; an empty header cell is named `Column N`.
- **Versions and search terms.** `DOCUMENT_CHUNKING_VERSIONS` holds one version per format (`markdown-1`, `text-1`); bump it when boundaries, content, or hashing change. Search terms come from the title and content with the function used for code.

## Consequences

- Windows of one long section share a locator, so the retrieval context budget keeps only the best window of a section. A part number on section locators would lift that if the evaluation shows lost evidence.
- Rows of yes/no permission matrices embed poorly: in the Stage 10 document evaluation, vector search missed one catalog row that lexical search found. Stage 11 adds one chunk per entity row.
- The built-in exclusions still skip `*.pdf` and image files in document folders; the stages that parse them must let them through.
