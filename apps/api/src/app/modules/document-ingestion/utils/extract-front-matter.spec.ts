import { extractFrontMatter } from './extract-front-matter';

describe('extractFrontMatter', () => {
  it('returns the lines between the fences and the lines the block takes', () => {
    expect(
      extractFrontMatter([
        '---',
        'title: Roles',
        'owner: docs',
        '---',
        '# Roles',
      ]),
    ).toEqual({ lines: ['title: Roles', 'owner: docs'], lineCount: 4 });
  });

  it('accepts a YAML document end marker and trailing spaces', () => {
    expect(extractFrontMatter(['--- ', 'a: 1', '...'])).toEqual({
      lines: ['a: 1'],
      lineCount: 3,
    });
  });

  it('ignores a block that does not open on the first line or never closes', () => {
    expect(
      extractFrontMatter(['# Roles', '---', 'a: 1', '---']),
    ).toBeUndefined();
    expect(extractFrontMatter(['---', 'Text after a rule'])).toBeUndefined();
    expect(extractFrontMatter([])).toBeUndefined();
  });
});
