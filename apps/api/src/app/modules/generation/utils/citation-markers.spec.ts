import {
  extractCitationNumbers,
  filterCitationNumbers,
} from './citation-markers';

describe('extractCitationNumbers', () => {
  it('reads single, grouped and adjacent markers in order of first use', () => {
    expect(
      extractCitationNumbers('A [2]. B [1, 3][2]. C [4,5] and [1].'),
    ).toEqual([2, 1, 3, 4, 5]);
  });

  it('ignores brackets inside code spans and fences', () => {
    const text =
      'Use `items[0]` here [1].\n```ts\nconst x = list[2];\n```\nDone [3].';
    expect(extractCitationNumbers(text)).toEqual([1, 3]);
  });

  it('returns nothing without markers', () => {
    expect(extractCitationNumbers('No evidence cited.')).toEqual([]);
  });
});

describe('filterCitationNumbers', () => {
  const keepUpTo = (max: number) => (n: number) => n >= 1 && n <= max;

  it('removes invalid markers with their leading space', () => {
    expect(filterCitationNumbers('Fact [1] and claim [9].', keepUpTo(2))).toBe(
      'Fact [1] and claim.',
    );
  });

  it('keeps the valid numbers of a group', () => {
    expect(filterCitationNumbers('Both [1, 7, 2].', keepUpTo(2))).toBe(
      'Both [1, 2].',
    );
  });

  it('leaves code untouched', () => {
    const text = 'See `arr[9]` [9].';
    expect(filterCitationNumbers(text, keepUpTo(2))).toBe('See `arr[9]`.');
  });

  it('returns the text unchanged when every marker is valid', () => {
    const text = 'One [1]. Two [2][1].';
    expect(filterCitationNumbers(text, keepUpTo(2))).toBe(text);
  });
});
