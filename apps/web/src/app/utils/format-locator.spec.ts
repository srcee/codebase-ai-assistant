import type { Locator } from '@codebase-ai/contracts';
import { formatLocator } from './format-locator';

describe('formatLocator', () => {
  it.each<[Locator, string]>([
    [{ kind: 'lines', startLine: 3, endLine: 9 }, 'L3-L9'],
    [{ kind: 'lines', startLine: 4, endLine: 4 }, 'L4'],
    [{ kind: 'section', headingPath: ['Intro', 'Setup'] }, 'Intro > Setup'],
    [{ kind: 'page', page: 7 }, 'page 7'],
    [
      { kind: 'table_rows', rowStart: 2, rowEnd: 5, columns: ['role'] },
      'rows 2-5',
    ],
    [{ kind: 'schema_entity', entity: 'User' }, 'User'],
    [{ kind: 'image', region: 'header' }, 'header'],
    [{ kind: 'image', frame: 'login' }, 'login'],
    [{ kind: 'image' }, 'image'],
  ])('formats %j', (locator, expected) => {
    expect(formatLocator(locator)).toBe(expected);
  });
});
