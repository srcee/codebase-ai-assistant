import { testConfig } from '@codebase-ai/server-testing';
import { DOCUMENT_FORMATS } from '../constants/document-formats';
import type { DocumentFormat } from '../types/document-format';
import { defaultParseWorkerEntry } from '../utils/default-parse-worker-entry';
import { DocumentParsingService } from './document-parsing.service';
import { ParsingPoolService } from './parsing-pool.service';

jest.setTimeout(60_000);

const markdown = DOCUMENT_FORMATS.find(
  (format) => format.id === 'markdown',
) as DocumentFormat;
const encode = (text: string) => new TextEncoder().encode(text);

describe('DocumentParsingService', () => {
  const config = testConfig({
    PARSE_INLINE_MAX_BYTES: '64',
    PARSE_WORKERS: '1',
    CHUNK_MAX_CHARS: '500',
    CHUNK_OVERLAP_CHARS: '50',
  });
  const pool = new ParsingPoolService(config, defaultParseWorkerEntry());
  const service = new DocumentParsingService(config, pool);

  afterAll(() => pool.beforeApplicationShutdown());

  it('parses a small text document in the API thread', async () => {
    const parse = jest.spyOn(pool, 'parse');
    await expect(
      service.parse(markdown, encode('# Small\n\nText.\n')),
    ).resolves.toMatchObject({ kind: 'chunks', chunks: [{ title: 'Small' }] });
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it('sends a text document above the inline limit to the pool with the chunk limits', async () => {
    const parse = jest.spyOn(pool, 'parse');
    const result = await service.parse(
      markdown,
      encode(
        `# Large\n\n${'The reviewer approves the request. '.repeat(40)}\n`,
      ),
    );
    expect(parse).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('chunks');
    for (const chunk of result.kind === 'chunks' ? result.chunks : []) {
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    }
    parse.mockRestore();
  });
});
