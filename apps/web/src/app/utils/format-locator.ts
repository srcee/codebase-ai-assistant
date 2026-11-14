import type { Locator } from '@codebase-ai/contracts';

export function formatLocator(locator: Locator): string {
  switch (locator.kind) {
    case 'lines':
      return locator.startLine === locator.endLine
        ? `L${locator.startLine}`
        : `L${locator.startLine}-L${locator.endLine}`;
    case 'section':
      return locator.headingPath.join(' > ');
    case 'page':
      return `page ${locator.page}`;
    case 'table_rows':
      return `rows ${locator.rowStart}-${locator.rowEnd}`;
    case 'schema_entity':
      return locator.entity;
    case 'image':
      return locator.region ?? locator.frame ?? 'image';
  }
}
