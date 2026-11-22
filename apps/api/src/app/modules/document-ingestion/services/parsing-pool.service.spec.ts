import { Logger } from '@nestjs/common';
import { testConfig } from '@codebase-ai/server-testing';
import {
  fixtureParseWorkerEntry,
  PARSE_WORKER_MARKERS,
} from '../../../../testing/parse-worker-fixtures';
import { ParseCancelledError } from '../errors/parse-cancelled.error';
import type { ParseRequest } from '../types/parse-request';
import type { ParseWorkerEntry } from '../types/parse-worker-entry';
import { defaultParseWorkerEntry } from '../utils/default-parse-worker-entry';
import { ParsingPoolService } from './parsing-pool.service';

// Workers load TypeScript through ts-node in specs, which takes a moment per worker.
jest.setTimeout(60_000);

const LIMITS = { chunkMaxChars: 2000, chunkOverlapChars: 200 };

const request = (text: string): ParseRequest => ({
  format: 'markdown',
  bytes: new TextEncoder().encode(text),
  limits: LIMITS,
});

describe('ParsingPoolService', () => {
  let pool: ParsingPoolService | undefined;

  const createPool = (
    entry: ParseWorkerEntry,
    env: Record<string, string> = {},
  ): ParsingPoolService => {
    pool = new ParsingPoolService(
      testConfig({ PARSE_WORKERS: '1', ...env }),
      entry,
    );
    return pool;
  };

  afterEach(async () => {
    await pool?.beforeApplicationShutdown();
    pool = undefined;
    jest.restoreAllMocks();
  });

  it('parses with the real worker entry and transfers the bytes', async () => {
    const parsing = createPool(defaultParseWorkerEntry());
    const task = request('# Roles\n\nReviewers approve requests.\n');

    await expect(parsing.parse(task)).resolves.toMatchObject({
      kind: 'chunks',
      chunks: [
        {
          title: 'Roles',
          locator: { kind: 'section', headingPath: ['Roles'] },
        },
      ],
    });
    expect(task.bytes.byteLength).toBe(0);
  });

  it('starts the TypeScript entry even when the runner sets ts-node options', async () => {
    const previous = process.env['TS_NODE_COMPILER_OPTIONS'];
    process.env['TS_NODE_COMPILER_OPTIONS'] = JSON.stringify({
      moduleResolution: 'node10',
      module: 'commonjs',
    });
    try {
      const parsing = createPool(defaultParseWorkerEntry());
      await expect(parsing.parse(request('# Roles\n'))).resolves.toMatchObject({
        kind: 'chunks',
      });
    } finally {
      if (previous === undefined)
        delete process.env['TS_NODE_COMPILER_OPTIONS'];
      else process.env['TS_NODE_COMPILER_OPTIONS'] = previous;
    }
  });

  it('queues files while every worker is busy', async () => {
    const parsing = createPool(defaultParseWorkerEntry());
    const results = await Promise.all(
      [1, 2, 3].map((n) => parsing.parse(request(`# Doc ${n}\n\nText.\n`))),
    );
    expect(
      results.map((result) =>
        result.kind === 'chunks' ? result.chunks[0].title : result.kind,
      ),
    ).toEqual(['Doc 1', 'Doc 2', 'Doc 3']);
  });

  it.each([
    ['hangs', PARSE_WORKER_MARKERS.hang, 'parse_timeout'],
    ['exits', PARSE_WORKER_MARKERS.exit, 'parse_crashed'],
    ['throws', PARSE_WORKER_MARKERS.throw, 'parse_crashed'],
  ])(
    'fails only the file whose worker %s and replaces the worker',
    async (_, marker, code) => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const parsing = createPool(fixtureParseWorkerEntry(), {
        PARSE_TIMEOUT_MS: '1000',
      });

      await expect(
        parsing.parse(request(`# Bad\n\n${marker}\n`)),
      ).resolves.toEqual({ kind: 'failed', code });
      await expect(
        parsing.parse(request('# Good\n\nText.\n')),
      ).resolves.toMatchObject({ kind: 'chunks' });
      expect(warn).toHaveBeenCalledWith(`Parse worker replaced: ${code}`);
    },
  );

  it('cancels a queued and a running parse when their signals abort', async () => {
    const parsing = createPool(fixtureParseWorkerEntry());
    const running = new AbortController();
    const queued = new AbortController();
    const first = parsing.parse(
      request(PARSE_WORKER_MARKERS.hang),
      running.signal,
    );
    const second = parsing.parse(request('# Next\n'), queued.signal);

    queued.abort();
    await expect(second).rejects.toBeInstanceOf(ParseCancelledError);
    running.abort();
    await expect(first).rejects.toBeInstanceOf(ParseCancelledError);
    await expect(
      parsing.parse(request('# After\n\nText.\n')),
    ).resolves.toMatchObject({ kind: 'chunks' });
    await expect(
      parsing.parse(request('# Late\n'), AbortSignal.abort()),
    ).rejects.toBeInstanceOf(ParseCancelledError);
  });

  it('cancels open parses on shutdown and refuses new ones', async () => {
    const parsing = createPool(fixtureParseWorkerEntry());
    const open = expect(
      parsing.parse(request(PARSE_WORKER_MARKERS.hang)),
    ).rejects.toBeInstanceOf(ParseCancelledError);
    const queued = expect(
      parsing.parse(request('# Queued\n')),
    ).rejects.toBeInstanceOf(ParseCancelledError);

    await parsing.beforeApplicationShutdown();

    await open;
    await queued;
    await expect(parsing.parse(request('# Late\n'))).rejects.toBeInstanceOf(
      ParseCancelledError,
    );
  });
});
