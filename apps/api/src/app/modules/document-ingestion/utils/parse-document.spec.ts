import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { parseDocument } from './parse-document';

const LIMITS = { chunkMaxChars: 2000, chunkOverlapChars: 200 };
const encode = (text: string) => new TextEncoder().encode(text);

describe('parseDocument', () => {
  it('chunks Markdown and plain text by their format', () => {
    const markdown = parseDocument({
      format: 'markdown',
      bytes: encode('# Roles\n\nReviewers approve.\n'),
      limits: LIMITS,
    });
    expect(markdown).toMatchObject({
      kind: 'chunks',
      chunks: [{ locator: { kind: 'section', headingPath: ['Roles'] } }],
    });
    const text = parseDocument({
      format: 'text',
      bytes: encode('# Roles\n\nReviewers approve.\n'),
      limits: LIMITS,
    });
    expect(text).toMatchObject({
      kind: 'chunks',
      chunks: [{ locator: { kind: 'lines', startLine: 1, endLine: 3 } }],
    });
  });

  it('normalizes a BOM and CRLF line endings', () => {
    const result = parseDocument({
      format: 'text',
      bytes: encode('\uFEFFfirst\r\nsecond\r\n'),
      limits: LIMITS,
    });
    expect(result).toMatchObject({
      kind: 'chunks',
      chunks: [{ content: 'first\nsecond' }],
    });
  });

  it.each([
    ['a NUL byte', Uint8Array.from([0x41, 0x00, 0x42])],
    ['a PDF signature', encode('%PDF-1.7\nnot really text')],
  ])('skips a file with %s as binary', (_, bytes) => {
    expect(
      parseDocument({ format: 'markdown', bytes, limits: LIMITS }),
    ).toEqual({ kind: 'skipped', reason: 'binary' });
  });

  it('skips invalid UTF-8 and secret-looking content without returning text', () => {
    expect(
      parseDocument({
        format: 'text',
        bytes: Uint8Array.from([0xc3, 0x28]),
        limits: LIMITS,
      }),
    ).toEqual({ kind: 'skipped', reason: 'invalid-encoding' });
    expect(
      parseDocument({
        format: 'markdown',
        bytes: encode(`# Setup\n\nTOKEN=${CANARY_SECRET}\n`),
        limits: LIMITS,
      }),
    ).toEqual({ kind: 'skipped', reason: 'secret-content' });
  });
});
