import { chunkPlainText } from './chunk-plain-text';

const LIMITS = { chunkMaxChars: 2000, chunkOverlapChars: 200 };

describe('chunkPlainText', () => {
  it('packs paragraphs into prose chunks with a lines locator', () => {
    const chunks = chunkPlainText(
      '\nReviewers approve requests.\nAdmins delete projects.\n\nGuests read.\n',
      LIMITS,
    );
    expect(chunks).toEqual([
      expect.objectContaining({
        title: null,
        contentKind: 'prose',
        content:
          'Reviewers approve requests.\nAdmins delete projects.\n\nGuests read.',
        locator: { kind: 'lines', startLine: 2, endLine: 5 },
      }),
    ]);
  });

  it('splits a long single line instead of skipping it', () => {
    const line = 'The reviewer checks the request. '.repeat(40).trim();
    const chunks = chunkPlainText(line, {
      chunkMaxChars: 200,
      chunkOverlapChars: 50,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(200);
      expect(chunk.locator).toEqual({
        kind: 'lines',
        startLine: 1,
        endLine: 1,
      });
    }
  });

  it('returns nothing for blank text', () => {
    expect(chunkPlainText('', LIMITS)).toEqual([]);
    expect(chunkPlainText('\n  \n', LIMITS)).toEqual([]);
  });
});
