import type { Locator } from '@codebase-ai/contracts';
import { formatLocator } from './format-locator';

describe('formatLocator', () => {
  it.each<[Locator, string]>([
    [{ kind: 'lines', startLine: 3, endLine: 9 }, 'L3-L9'],
    [{ kind: 'lines', startLine: 4, endLine: 4 }, 'L4'],
    [
      { kind: 'section', headingPath: ['Intro', 'Setup'], page: 2 },
      'Intro > Setup, page 2',
    ],
    [{ kind: 'page', page: 7 }, 'page 7'],
    [
      {
        kind: 'table_rows',
        sheet: 'Roles',
        rowStart: 2,
        rowEnd: 5,
        columns: ['a'],
      },
      'sheet Roles, rows 2-5',
    ],
    [
      { kind: 'schema_entity', entity: 'User', path: '$.defs.User' },
      'User ($.defs.User)',
    ],
    [{ kind: 'image' }, 'image'],
  ])('formats %j', (locator, expected) => {
    expect(formatLocator(locator)).toBe(expected);
  });
});
