import { isBlank, splitLines } from './split-lines';

describe('splitLines', () => {
  it.each([
    ['', []],
    ['a', ['a']],
    ['a\n', ['a']],
    ['a\n\n', ['a', '']],
    ['a\nb', ['a', 'b']],
    ['\n', ['']],
  ])('splits %j', (text, lines) => {
    expect(splitLines(text)).toEqual(lines);
  });
});

describe('isBlank', () => {
  it('detects blank lines', () => {
    expect(isBlank(' \t')).toBe(true);
    expect(isBlank(' a ')).toBe(false);
  });
});
