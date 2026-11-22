import MarkdownIt, { type Token } from 'markdown-it';
import type { ChunkLimits } from '../../ingestion/types/line-range';
import { splitLines } from '../../ingestion/utils/split-lines';
import { trimBlankEdges } from '../../ingestion/utils/trim-blank-edges';
import type { DocumentChunk } from '../types/document-chunk';
import type { ProseBlock } from '../types/prose-block';
import { chunkTableRows } from './chunk-table-rows';
import { extractFrontMatter } from './extract-front-matter';
import { headingName, titleOf } from './heading-path';
import { inlineText } from './inline-text';
import { splitProseWindows } from './split-prose-windows';
import { toDocumentChunk } from './to-document-chunk';

type Item =
  | { kind: 'heading'; level: number; name: string }
  | { kind: 'block'; block: ProseBlock }
  | { kind: 'table'; header: string[]; rows: string[][] };

interface OpenHeading {
  level: number;
  name: string;
}

// Raw HTML stays text and URLs are not linkified; the parser only finds structure.
const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

const FIRST_DATA_ROW = 2;

/**
 * Splits Markdown by headings: each section's own text becomes `section` chunks titled with its heading path,
 * and a window never crosses a heading. Tables become `table_rows` chunks. Front matter and text before
 * the first heading become `lines` chunks. Content keeps the Markdown source, not rendered HTML.
 */
export function chunkMarkdown(
  text: string,
  limits: ChunkLimits,
): DocumentChunk[] {
  const lines = splitLines(text);
  const frontMatter = extractFrontMatter(lines);
  const offset = frontMatter?.lineCount ?? 0;
  const items: Item[] = [];
  if (frontMatter) {
    const block = blockOf(lines, 2, frontMatter.lineCount - 1);
    if (block) items.push(block);
  }
  const tokens = markdown.parse(lines.slice(offset).join('\n'), {});
  items.push(...itemsOf(tokens, lines, offset));
  return chunkItems(items, limits);
}

function itemsOf(
  tokens: readonly Token[],
  lines: readonly string[],
  offset: number,
): Item[] {
  const items: Item[] = [];
  tokens.forEach((token, index) => {
    if (token.level !== 0 || token.nesting === -1 || !token.map) return;
    if (token.type === 'heading_open') {
      items.push({
        kind: 'heading',
        level: Number(token.tag.slice(1)),
        name: headingName(inlineText(tokens[index + 1])),
      });
    } else if (token.type === 'table_open') {
      items.push(tableOf(tokens, index));
    } else if (token.type !== 'hr') {
      const block = blockOf(
        lines,
        token.map[0] + offset + 1,
        token.map[1] + offset,
      );
      if (block) items.push(block);
    }
  });
  return items;
}

function tableOf(tokens: readonly Token[], start: number): Item {
  let header: string[] = [];
  const rows: string[][] = [];
  let row: string[] = [];
  let inHead = false;
  for (
    let index = start + 1;
    index < tokens.length && tokens[index].type !== 'table_close';
    index++
  ) {
    const token = tokens[index];
    if (token.type === 'thead_open') inHead = true;
    else if (token.type === 'thead_close') inHead = false;
    else if (token.type === 'tr_open') row = [];
    else if (token.type === 'inline') row.push(inlineText(token));
    else if (token.type === 'tr_close') {
      if (inHead) header = row;
      else rows.push(row);
    }
  }
  return { kind: 'table', header, rows };
}

function blockOf(
  lines: readonly string[],
  startLine: number,
  endLine: number,
): Item | undefined {
  const range = trimBlankEdges(lines, startLine, endLine);
  if (!range) return undefined;
  return {
    kind: 'block',
    block: {
      text: lines.slice(range.startLine - 1, range.endLine).join('\n'),
      startLine: range.startLine,
      endLine: range.endLine,
    },
  };
}

function chunkItems(
  items: readonly Item[],
  limits: ChunkLimits,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const open: OpenHeading[] = [];
  let run: ProseBlock[] = [];
  let tableIndex = 0;
  const flush = () => {
    chunks.push(...proseChunks(run, open, limits));
    run = [];
  };

  for (const item of items) {
    if (item.kind === 'block') {
      run.push(item.block);
      continue;
    }
    flush();
    if (item.kind === 'heading') {
      while (open.length > 0 && open[open.length - 1].level >= item.level) {
        open.pop();
      }
      open.push({ level: item.level, name: item.name });
    } else {
      tableIndex++;
      chunks.push(
        ...chunkTableRows(
          {
            title:
              open.length === 0
                ? null
                : titleOf(headingPathOf(open), limits.chunkMaxChars),
            tableIndex,
            header: item.header,
            rows: item.rows,
            firstRowNumber: FIRST_DATA_ROW,
          },
          limits,
        ),
      );
    }
  }
  flush();
  return chunks;
}

function proseChunks(
  run: readonly ProseBlock[],
  open: readonly OpenHeading[],
  limits: ChunkLimits,
): DocumentChunk[] {
  if (open.length === 0) {
    return splitProseWindows(
      run,
      limits.chunkMaxChars,
      limits.chunkOverlapChars,
    ).map((window) =>
      toDocumentChunk({
        title: null,
        contentKind: 'prose',
        locator: {
          kind: 'lines',
          startLine: window.startLine,
          endLine: window.endLine,
        },
        content: window.text,
      }),
    );
  }
  const headingPath = headingPathOf(open);
  const title = titleOf(headingPath, limits.chunkMaxChars);
  const prefix = `${title}\n\n`;
  return splitProseWindows(
    run,
    limits.chunkMaxChars - prefix.length,
    limits.chunkOverlapChars,
  ).map((window) =>
    toDocumentChunk({
      title,
      contentKind: 'prose',
      locator: { kind: 'section', headingPath },
      content: `${prefix}${window.text}`,
    }),
  );
}

const headingPathOf = (open: readonly OpenHeading[]): string[] =>
  open.map((heading) => heading.name);
