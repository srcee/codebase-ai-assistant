import { Logger } from '@nestjs/common';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import {
  FakeLoopbackServer,
  respondJson,
  respondLines,
  testConfig,
} from '@codebase-ai/server-testing';
import { EgressHttpError } from '../errors/egress-http.error';
import { EgressUnavailableError } from '../errors/egress-unavailable.error';
import { EgressHttpClient } from './egress-http-client.service';

describe('EgressHttpClient', () => {
  let server: FakeLoopbackServer;
  let client: EgressHttpClient;

  beforeEach(async () => {
    server = await FakeLoopbackServer.start();
    client = new EgressHttpClient(
      { origin: server.baseUrl },
      testConfig({ INFERENCE_BASE_URL: server.baseUrl }),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await server.stop();
  });

  const collect = async <T>(source: AsyncIterable<T>): Promise<T[]> => {
    const items: T[] = [];
    for await (const item of source) items.push(item);
    return items;
  };

  describe('JSON requests', () => {
    it('returns the parsed body of a GET', async () => {
      const body = { value: faker.lorem.word() };
      server.on('GET', '/status', (_req, res) => respondJson(res, 200, body));
      await expect(client.getJson('/status')).resolves.toEqual(body);
    });

    it('posts a JSON body', async () => {
      const payload = { text: faker.lorem.sentence() };
      server.on('POST', '/echo', (_req, res) => respondJson(res, 200, {}));
      await client.postJson('/echo', payload);
      expect(server.requestsTo('/echo')[0].body).toEqual(payload);
    });

    it('raises an HTTP error carrying only the status', async () => {
      server.on('GET', '/status', (_req, res) =>
        respondJson(res, 500, { error: CANARY_SECRET }),
      );
      const error = await client.getJson('/status').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EgressHttpError);
      expect((error as EgressHttpError).status).toBe(500);
      assertNotLeaked((error as Error).message, CANARY_SECRET);
    });

    it('reports an unreachable server as unavailable', async () => {
      await server.stop();
      await expect(client.getJson('/status')).rejects.toMatchObject({
        name: 'EgressUnavailableError',
        reason: 'network',
      });
      server = await FakeLoopbackServer.start();
    });

    it('reports a slow server as a timeout', async () => {
      server.on('GET', '/status', () => undefined);
      await expect(
        client.getJson('/status', { timeoutMs: 50 }),
      ).rejects.toMatchObject({ reason: 'timeout' });
    });

    it('reports a non-JSON body as an invalid response', async () => {
      server.on('GET', '/status', (_req, res) => {
        res.writeHead(200);
        res.end('not json');
      });
      await expect(client.getJson('/status')).rejects.toMatchObject({
        reason: 'invalid-response',
      });
    });

    it('lets a caller abort propagate as is', async () => {
      server.on('GET', '/status', () => undefined);
      const controller = new AbortController();
      const pending = client.getJson('/status', {
        signal: controller.signal,
      });
      controller.abort();
      const error = await pending.catch((e: unknown) => e);
      expect(error).not.toBeInstanceOf(EgressUnavailableError);
      expect((error as Error).name).toBe('AbortError');
    });
  });

  describe('egress policy', () => {
    it('does not follow redirects', async () => {
      const elsewhere = await FakeLoopbackServer.start();
      elsewhere.on('GET', '/status', (_req, res) => respondJson(res, 200, {}));
      server.on('GET', '/status', (_req, res) => {
        res.writeHead(302, { location: `${elsewhere.baseUrl}/status` });
        res.end();
      });
      await expect(client.getJson('/status')).rejects.toBeInstanceOf(
        EgressUnavailableError,
      );
      expect(elsewhere.requests).toHaveLength(0);
      await elsewhere.stop();
    });

    it.each(['http://example.com/status', '//example.com/status', 'status'])(
      'refuses to leave the pinned origin via %s',
      async (path) => {
        const fetchSpy = jest.spyOn(globalThis, 'fetch');
        await expect(client.getJson(path)).rejects.toMatchObject({
          name: 'EgressUnavailableError',
          reason: 'blocked',
        });
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    it('sends every request only to the configured origin, with no fallback', async () => {
      await server.stop();
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      await client.getJson('/status').catch(() => undefined);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const target = new URL(String(fetchSpy.mock.calls[0][0]));
      expect(target.origin).toBe(server.baseUrl);
      server = await FakeLoopbackServer.start();
    });
  });

  describe('streaming', () => {
    it('yields trimmed non-empty lines in order, including a final line without newline', async () => {
      server.on('POST', '/stream', (_req, res) => {
        res.writeHead(200);
        res.write('first\n\n  second  \r\n');
        res.end('last');
      });
      await expect(collect(client.postLines('/stream', {}))).resolves.toEqual([
        'first',
        'second',
        'last',
      ]);
    });

    it('passes lines through without interpreting their format', async () => {
      const lines = ['data: {"a":1}', 'not json', '{"b":2}'];
      server.on('POST', '/stream', (_req, res) => respondLines(res, lines, 5));
      await expect(collect(client.postLines('/stream', {}))).resolves.toEqual(
        lines,
      );
    });

    it('rejects a line longer than the limit', async () => {
      server.on('POST', '/stream', (_req, res) => {
        res.writeHead(200);
        res.end('x'.repeat(1024 * 1024 + 1));
      });
      await expect(
        collect(client.postLines('/stream', {})),
      ).rejects.toMatchObject({ reason: 'invalid-response' });
    });

    it('times out when the server goes quiet between chunks', async () => {
      server.on('POST', '/stream', (_req, res) => {
        res.writeHead(200);
        res.write('first\n');
      });
      await expect(
        collect(client.postLines('/stream', {}, { timeoutMs: 100 })),
      ).rejects.toMatchObject({ reason: 'timeout' });
    });

    it('closes the connection when the consumer stops early', async () => {
      let closed: Promise<void> | undefined;
      server.on('POST', '/stream', (_req, res) => {
        closed = new Promise((resolve) => res.on('close', () => resolve()));
        res.writeHead(200);
        res.write('first\n');
      });
      const lines = client.postLines('/stream', {});
      await lines.next();
      await lines.return();
      await expect(closed).resolves.toBeUndefined();
    });
  });

  describe('logging', () => {
    it('never logs request input or response bodies', async () => {
      const logged: unknown[] = [];
      for (const level of [
        'debug',
        'log',
        'warn',
        'error',
        'verbose',
      ] as const) {
        jest
          .spyOn(Logger.prototype, level)
          .mockImplementation((...args: unknown[]) => {
            logged.push(args);
          });
      }
      server.on('POST', '/fail', (_req, res) =>
        respondJson(res, 500, { error: CANARY_SECRET }),
      );
      server.on('POST', '/ok', (_req, res) =>
        respondJson(res, 200, { echoed: CANARY_SECRET }),
      );

      await client
        .postJson('/fail', { input: [CANARY_SECRET] })
        .catch(() => undefined);
      await client.postJson('/ok', { input: [CANARY_SECRET] });
      server.on('POST', '/slow', () => undefined);
      await client
        .postJson('/slow', { input: [CANARY_SECRET] }, { timeoutMs: 50 })
        .catch(() => undefined);

      expect(logged.length).toBeGreaterThan(0);
      assertNotLeaked(logged, CANARY_SECRET);
    });
  });
});
