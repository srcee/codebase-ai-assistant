import { documentFormatFor } from './document-format-for';

describe('documentFormatFor', () => {
  it.each([
    ['specs/roles.md', 'markdown'],
    ['README.MD', 'markdown'],
    ['guides/setup.markdown', 'markdown'],
    ['notes/glossary.txt', 'text'],
  ])('maps %s to %s', (path, id) => {
    expect(documentFormatFor(path)?.id).toBe(id);
  });

  it.each([
    'roles.pdf',
    'matrix.xlsx',
    'logo.png',
    'Makefile',
    'archive.md.zip',
  ])('has no parser for %s', (path) => {
    expect(documentFormatFor(path)).toBeUndefined();
  });

  it('parses text formats inline and names their media type', () => {
    expect(documentFormatFor('a.md')).toMatchObject({
      encoding: 'text',
      mediaType: 'text/markdown',
    });
    expect(documentFormatFor('a.txt')).toMatchObject({
      encoding: 'text',
      mediaType: 'text/plain',
    });
  });
});
