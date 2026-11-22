import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { handleParseRequest } from './handle-parse-request';
import * as parsing from './parse-document';

describe('handleParseRequest', () => {
  afterEach(() => jest.restoreAllMocks());

  const request = {
    format: 'markdown' as const,
    bytes: new TextEncoder().encode('# Roles\n\nText.\n'),
    limits: { chunkMaxChars: 2000, chunkOverlapChars: 200 },
  };

  it('returns the parse result', () => {
    expect(handleParseRequest(request)).toMatchObject({ kind: 'chunks' });
  });

  it('turns a parser exception into a failure code without its message', () => {
    jest.spyOn(parsing, 'parseDocument').mockImplementation(() => {
      throw new Error(`parser quoted ${CANARY_SECRET}`);
    });
    const result = handleParseRequest(request);
    expect(result).toEqual({ kind: 'failed', code: 'parse_failed' });
    expect(JSON.stringify(result)).not.toContain(CANARY_SECRET);
  });
});
