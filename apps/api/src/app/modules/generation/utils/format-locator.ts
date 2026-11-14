import type { Locator } from '@codebase-ai/contracts';

export function formatLocator(locator: Locator): string {
  switch (locator.kind) {
    case 'lines':
      return locator.startLine === locator.endLine
        ? `L${locator.startLine}`
        : `L${locator.startLine}-L${locator.endLine}`;
    case 'section':
      return [
        locator.headingPath.join(' > ') || '(untitled section)',
        locator.page === undefined ? undefined : `page ${locator.page}`,
      ]
        .filter(Boolean)
        .join(', ');
    case 'page':
      return `page ${locator.page}`;
    case 'table_rows':
      return [
        locator.sheet === undefined ? undefined : `sheet ${locator.sheet}`,
        locator.tableIndex === undefined
          ? undefined
          : `table ${locator.tableIndex}`,
        `rows ${locator.rowStart}-${locator.rowEnd}`,
      ]
        .filter(Boolean)
        .join(', ');
    case 'schema_entity':
      return locator.path === undefined
        ? locator.entity
        : `${locator.entity} (${locator.path})`;
    case 'image':
      return (
        [locator.frame, locator.region].filter(Boolean).join(', ') || 'image'
      );
  }
}
