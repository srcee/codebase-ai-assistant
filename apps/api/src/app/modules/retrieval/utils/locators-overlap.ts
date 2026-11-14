import type { Locator } from '@codebase-ai/contracts';

const rangesOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean => aStart <= bEnd && bStart <= aEnd;

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((part, index) => part === b[index]);

/** Whether two locators in the same file cover the same content. */
export function locatorsOverlap(a: Locator, b: Locator): boolean {
  switch (a.kind) {
    case 'lines':
      return (
        b.kind === 'lines' &&
        rangesOverlap(a.startLine, a.endLine, b.startLine, b.endLine)
      );
    case 'section':
      return (
        b.kind === 'section' &&
        a.page === b.page &&
        samePath(a.headingPath, b.headingPath)
      );
    case 'page':
      return b.kind === 'page' && a.page === b.page;
    case 'table_rows':
      return (
        b.kind === 'table_rows' &&
        a.sheet === b.sheet &&
        a.tableIndex === b.tableIndex &&
        rangesOverlap(a.rowStart, a.rowEnd, b.rowStart, b.rowEnd)
      );
    case 'schema_entity':
      return (
        b.kind === 'schema_entity' && a.entity === b.entity && a.path === b.path
      );
    case 'image':
      return b.kind === 'image' && a.frame === b.frame && a.region === b.region;
  }
}
