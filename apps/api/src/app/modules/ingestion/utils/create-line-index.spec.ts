import { createLineIndex } from './create-line-index';

describe('createLineIndex', () => {
  const lineOf = createLineIndex('ab\ncd\n\nef');

  it.each([
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [7, 4],
    [8, 4],
  ])('maps offset %i to line %i', (offset, line) => {
    expect(lineOf(offset)).toBe(line);
  });

  it('counts LF only', () => {
    expect(createLineIndex('a\u2028b\rc')(4)).toBe(1);
  });
});
