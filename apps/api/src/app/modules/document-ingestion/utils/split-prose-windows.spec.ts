import type { ProseBlock } from '../types/prose-block';
import { splitProseWindows } from './split-prose-windows';

const block = (
  text: string,
  startLine: number,
  endLine = startLine,
): ProseBlock => ({
  text,
  startLine,
  endLine,
});

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

describe('splitProseWindows', () => {
  it('packs blocks that fit into one window separated by blank lines', () => {
    expect(
      splitProseWindows([block('First.', 1), block('Second.', 3, 4)], 100, 10),
    ).toEqual([{ text: 'First.\n\nSecond.', startLine: 1, endLine: 4 }]);
  });

  it('starts a new window when the next block does not fit and never exceeds the limit', () => {
    const blocks = [
      block('a'.repeat(30), 1),
      block('b'.repeat(30), 3),
      block('c'.repeat(30), 5),
    ];
    const windows = splitProseWindows(blocks, 70, 0);
    expect(windows.map((window) => window.text)).toEqual([
      `${'a'.repeat(30)}\n\n${'b'.repeat(30)}`,
      'c'.repeat(30),
    ]);
    expect(windows[1]).toMatchObject({ startLine: 5, endLine: 5 });
  });

  it('repeats the end of the previous window as overlap', () => {
    const blocks = [
      block('one '.repeat(5).trim(), 1),
      block('two', 2),
      block('three '.repeat(10).trim(), 3),
    ];
    const [first, second] = splitProseWindows(blocks, 40, 10);
    expect(first.text.endsWith('two')).toBe(true);
    expect(second.text.startsWith('two\n\n')).toBe(true);
    expect(second.startLine).toBe(2);
  });

  it('splits a long single-line paragraph into sentences and keeps every word in order', () => {
    const sentence = (index: number) =>
      `Sentence number ${index} talks about reviewers.`;
    const text = Array.from({ length: 20 }, (_, index) => sentence(index)).join(
      ' ',
    );
    const windows = splitProseWindows([block(text, 7)], 120, 0);

    expect(windows.length).toBeGreaterThan(1);
    for (const window of windows) {
      expect(window.text.length).toBeLessThanOrEqual(120);
      expect(window).toMatchObject({ startLine: 7, endLine: 7 });
    }
    expect(words(windows.map((window) => window.text).join(' '))).toEqual(
      words(text),
    );
  });

  it('splits a long multi-line block on its lines and keeps their numbers', () => {
    const lines = Array.from(
      { length: 10 },
      (_, index) => `line ${index + 1} ${'x'.repeat(20)}`,
    );
    const windows = splitProseWindows([block(lines.join('\n'), 11, 20)], 70, 0);
    expect(windows[0]).toMatchObject({ startLine: 11, endLine: 12 });
    expect(windows[windows.length - 1].endLine).toBe(20);
    expect(windows.map((window) => window.text).join('\n')).toBe(
      lines.join('\n'),
    );
  });

  it('cuts a word longer than a window by code point', () => {
    const word = '😀'.repeat(30);
    const windows = splitProseWindows([block(word, 1)], 20, 0);
    expect(windows.map((window) => window.text).join('')).toBe(word);
    for (const window of windows) {
      expect(window.text.length).toBeLessThanOrEqual(20);
      expect(() => encodeURIComponent(window.text)).not.toThrow();
    }
  });

  it('limits the overlap to half a window so every window advances', () => {
    const blocks = Array.from({ length: 6 }, (_, index) =>
      block(`${index}`.repeat(9), index + 1),
    );
    const windows = splitProseWindows(blocks, 20, 19);
    for (let index = 1; index < windows.length; index++) {
      expect(windows[index].endLine).toBeGreaterThan(
        windows[index - 1].endLine,
      );
    }
  });

  it('returns nothing for blank input', () => {
    expect(splitProseWindows([], 100, 10)).toEqual([]);
    expect(splitProseWindows([block('   ', 1)], 100, 10)).toEqual([]);
  });
});
