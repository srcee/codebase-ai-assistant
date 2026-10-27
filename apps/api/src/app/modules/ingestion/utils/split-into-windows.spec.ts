import { splitIntoWindows } from './split-into-windows';

const lines = (count: number, width = 10) =>
  Array.from({ length: count }, (_, i) => String(i + 1).padEnd(width, 'x'));

describe('splitIntoWindows', () => {
  it('returns one window when everything fits', () => {
    expect(
      splitIntoWindows(lines(3), 1, 3, {
        chunkMaxChars: 100,
        chunkOverlapChars: 10,
      }),
    ).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it('cuts at line boundaries, never exceeds the limit and repeats the overlap', () => {
    const source = lines(10);
    const windows = splitIntoWindows(source, 1, 10, {
      chunkMaxChars: 35,
      chunkOverlapChars: 11,
    });
    expect(windows).toEqual([
      { startLine: 1, endLine: 3 },
      { startLine: 3, endLine: 5 },
      { startLine: 5, endLine: 7 },
      { startLine: 7, endLine: 9 },
      { startLine: 9, endLine: 10 },
    ]);
    for (const { startLine, endLine } of windows) {
      expect(
        source.slice(startLine - 1, endLine).join('\n').length,
      ).toBeLessThanOrEqual(35);
    }
  });

  it('always advances even when the overlap would cover the whole window', () => {
    const windows = splitIntoWindows(lines(6), 1, 6, {
      chunkMaxChars: 23,
      chunkOverlapChars: 22,
    });
    windows.slice(1).forEach((window, index) => {
      expect(window.startLine).toBeGreaterThan(windows[index].startLine);
    });
    expect(windows[windows.length - 1].endLine).toBe(6);
  });

  it('emits a line longer than the limit on its own', () => {
    const source = ['a', 'b'.repeat(50), 'c'];
    expect(
      splitIntoWindows(source, 1, 3, {
        chunkMaxChars: 20,
        chunkOverlapChars: 0,
      }),
    ).toEqual([
      { startLine: 1, endLine: 1 },
      { startLine: 2, endLine: 2 },
      { startLine: 3, endLine: 3 },
    ]);
  });

  it('trims blank edges, drops blank windows and keeps the symbol name', () => {
    const source = ['', 'a', '', '', '', '', 'b', ''];
    expect(
      splitIntoWindows(
        source,
        1,
        8,
        { chunkMaxChars: 5, chunkOverlapChars: 0 },
        'sym',
      ),
    ).toEqual([
      { startLine: 2, endLine: 2, symbolName: 'sym' },
      { startLine: 7, endLine: 7, symbolName: 'sym' },
    ]);
  });

  it('returns nothing for an empty range', () => {
    expect(
      splitIntoWindows([], 1, 0, { chunkMaxChars: 10, chunkOverlapChars: 0 }),
    ).toEqual([]);
  });
});
