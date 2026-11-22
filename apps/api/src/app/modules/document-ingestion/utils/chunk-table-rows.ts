import type { ChunkLimits } from '../../ingestion/types/line-range';
import type { DocumentChunk } from '../types/document-chunk';
import { splitProseWindows } from './split-prose-windows';
import { toDocumentChunk } from './to-document-chunk';
import { truncate } from './truncate';

const MAX_COLUMN_CHARS = 200;

export interface TableInput {
  /** Heading path of the section holding the table, or null outside any section. */
  title: string | null;
  /** 1-based position of the table in its document. */
  tableIndex: number;
  header: readonly string[];
  rows: readonly (readonly string[])[];
  /** Row number of the first data row; the header row is row 1. */
  firstRowNumber: number;
}

/**
 * Renders each row as `Header: value` lines so every chunk carries the column names, and packs rows into
 * chunks of at most `chunkMaxChars`; a row that does not fit alone is split across chunks.
 */
export function chunkTableRows(
  table: TableInput,
  limits: ChunkLimits,
): DocumentChunk[] {
  const columns = table.header.map(
    (name, index) =>
      truncate(name.trim(), MAX_COLUMN_CHARS) || `Column ${index + 1}`,
  );
  const prefix = table.title === null ? '' : `${table.title}\n\n`;
  const blocks = table.rows.map((row, index) => {
    const rowNumber = table.firstRowNumber + index;
    return {
      text: columns
        .map((column, position) => `${column}: ${(row[position] ?? '').trim()}`)
        .join('\n'),
      startLine: rowNumber,
      endLine: rowNumber,
    };
  });
  return splitProseWindows(blocks, limits.chunkMaxChars - prefix.length, 0).map(
    (window) =>
      toDocumentChunk({
        title: table.title,
        contentKind: 'table_rows',
        locator: {
          kind: 'table_rows',
          tableIndex: table.tableIndex,
          rowStart: window.startLine,
          rowEnd: window.endLine,
          columns,
        },
        content: `${prefix}${window.text}`,
      }),
  );
}
