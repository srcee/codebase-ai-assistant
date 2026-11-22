import { chunkTableRows, type TableInput } from './chunk-table-rows';

const LIMITS = { chunkMaxChars: 2000, chunkOverlapChars: 200 };

const table = (overrides: Partial<TableInput> = {}): TableInput => ({
  title: 'Roles > Permissions',
  tableIndex: 1,
  header: ['Role', 'Approve request', 'Delete project'],
  rows: [
    ['Reviewer', 'yes', 'no'],
    ['Admin', 'yes', 'yes'],
  ],
  firstRowNumber: 2,
  ...overrides,
});

describe('chunkTableRows', () => {
  it('renders every row as Header: value lines under the title', () => {
    const [chunk] = chunkTableRows(table(), LIMITS);
    expect(chunk.content).toBe(
      [
        'Roles > Permissions',
        '',
        'Role: Reviewer',
        'Approve request: yes',
        'Delete project: no',
        '',
        'Role: Admin',
        'Approve request: yes',
        'Delete project: yes',
      ].join('\n'),
    );
    expect(chunk).toMatchObject({
      title: 'Roles > Permissions',
      contentKind: 'table_rows',
      locator: {
        kind: 'table_rows',
        tableIndex: 1,
        rowStart: 2,
        rowEnd: 3,
        columns: ['Role', 'Approve request', 'Delete project'],
      },
    });
    expect(chunk.searchTerms.split(' ')).toEqual(
      expect.arrayContaining(['reviewer', 'approve', 'permissions']),
    );
  });

  it('splits rows across chunks within the limit and repeats the column names in each', () => {
    const rows = Array.from({ length: 30 }, (_, index) => [
      `Role ${index}`,
      'yes',
      'no',
    ]);
    const chunks = chunkTableRows(table({ rows }), {
      chunkMaxChars: 300,
      chunkOverlapChars: 100,
    });

    expect(chunks.length).toBeGreaterThan(1);
    let expectedStart = 2;
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(300);
      expect(chunk.content.startsWith('Roles > Permissions\n\nRole: ')).toBe(
        true,
      );
      const locator = chunk.locator as { rowStart: number; rowEnd: number };
      expect(locator.rowStart).toBe(expectedStart);
      expectedStart = locator.rowEnd + 1;
    }
    expect(expectedStart).toBe(32);
  });

  it('names empty header cells by position and leaves missing cells empty', () => {
    const [chunk] = chunkTableRows(
      table({ title: null, header: ['Role', ' '], rows: [['Reviewer']] }),
      LIMITS,
    );
    expect(chunk.content).toBe('Role: Reviewer\nColumn 2: ');
    expect(chunk.title).toBeNull();
    expect(chunk.locator).toMatchObject({ columns: ['Role', 'Column 2'] });
  });

  it('produces no chunk for a table without rows', () => {
    expect(chunkTableRows(table({ rows: [] }), LIMITS)).toEqual([]);
  });
});
