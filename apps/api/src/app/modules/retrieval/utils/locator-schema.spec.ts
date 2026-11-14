import { locatorSchema } from './locator-schema';

describe('locatorSchema', () => {
  it.each([
    { kind: 'lines', startLine: 1, endLine: 1 },
    { kind: 'section', headingPath: ['Roles', 'Reviewer'], page: 4 },
    { kind: 'page', page: 2 },
    {
      kind: 'table_rows',
      sheet: 'Permissions',
      tableIndex: 0,
      rowStart: 2,
      rowEnd: 9,
      columns: ['Role', 'Action'],
    },
    { kind: 'schema_entity', entity: 'Role', path: 'paths./roles.get' },
    { kind: 'image', region: 'header' },
  ])('accepts a valid $kind locator', (locator) => {
    expect(locatorSchema.parse(locator)).toEqual(locator);
  });

  it.each([
    ['an unknown kind', { kind: 'chapter', number: 1 }],
    ['a missing kind', { startLine: 1, endLine: 2 }],
    ['reversed lines', { kind: 'lines', startLine: 5, endLine: 4 }],
    ['line zero', { kind: 'lines', startLine: 0, endLine: 4 }],
    ['fractional lines', { kind: 'lines', startLine: 1.5, endLine: 4 }],
    ['an empty heading path', { kind: 'section', headingPath: [] }],
    [
      'reversed rows',
      { kind: 'table_rows', rowStart: 9, rowEnd: 2, columns: [] },
    ],
    ['an extra key', { kind: 'page', page: 1, content: 'x' }],
    ['a non-object', 'lines:1-2'],
  ])('rejects %s', (_label, locator) => {
    expect(locatorSchema.safeParse(locator).success).toBe(false);
  });
});
