import { Logger } from '@nestjs/common';
import {
  FakeLoopbackServer,
  ollamaChatChunkFactory,
  respondJson,
  respondLines,
  respondNdjson,
  testConfig,
} from '@codebase-ai/server-testing';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import { InferenceModelNotFoundError } from '../../errors/inference-model-not-found.error';
import { InferenceUnavailableError } from '../../errors/inference-unavailable.error';
import type { ChatMessage } from '../../types/chat-message';
import { OllamaChat } from './ollama-chat';

describe('OllamaChat', () => {
  let server: FakeLoopbackServer;

  const serviceWith = (env: Record<string, string> = {}) => {
    const config = testConfig({ INFERENCE_BASE_URL: server.baseUrl, ...env });
    return {
      config,
      service: new OllamaChat(
        new EgressHttpClient({ origin: server.baseUrl }, config),
        config,
      ),
    };
  };

  const messages = (): ChatMessage[] => [
    { role: 'system', content: faker.lorem.sentence() },
    { role: 'user', content: faker.lorem.sentence() },
  ];

  const collect = async (source: AsyncIterable<string>): Promise<string[]> => {
    const items: string[] = [];
    for await (const item of source) items.push(item);
    return items;
  };

  beforeEach(async () => {
    server = await FakeLoopbackServer.start();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await server.stop();
  });

  describe('complete', () => {
    it('sends the messages to the configured chat model without streaming', async () => {
      const reply = faker.lorem.sentence();
      server.on('POST', '/api/chat', (_req, res) =>
        respondJson(
          res,
          200,
          ollamaChatChunkFactory.build({
            message: { content: reply },
            done: true,
          }),
        ),
      );
      const { service, config } = serviceWith();
      const input = messages();

      await expect(service.complete(input)).resolves.toBe(reply);
      expect(server.requestsTo('/api/chat')[0].body).toEqual({
        model: config.inference.chatModel,
        messages: input,
        stream: false,
      });
    });

    it('reports a missing model without a fallback request', async () => {
      server.on('POST', '/api/chat', (_req, res) =>
        respondJson(res, 404, { error: 'model not found' }),
      );
      const { service } = serviceWith();

      await expect(service.complete(messages())).rejects.toBeInstanceOf(
        InferenceModelNotFoundError,
      );
      expect(server.requests).toHaveLength(1);
    });

    it('fails with InferenceUnavailableError when the server is down, without retrying', async () => {
      await server.stop();
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const { service } = serviceWith();

      await expect(service.complete(messages())).rejects.toBeInstanceOf(
        InferenceUnavailableError,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(new URL(String(fetchSpy.mock.calls[0][0])).origin).toBe(
        server.baseUrl,
      );
      server = await FakeLoopbackServer.start();
    });

    it('treats an error payload as an invalid response', async () => {
      server.on('POST', '/api/chat', (_req, res) =>
        respondJson(res, 200, { error: 'boom' }),
      );
      const { service } = serviceWith();

      await expect(service.complete(messages())).rejects.toMatchObject({
        reason: 'invalid-response',
      });
    });

    it('never logs or leaks the prompt on failure', async () => {
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
      server.on('POST', '/api/chat', (_req, res) =>
        respondJson(res, 500, { error: CANARY_SECRET }),
      );
      const { service } = serviceWith();

      const error = await service
        .complete([{ role: 'user', content: CANARY_SECRET }])
        .catch((e: unknown) => e);

      assertNotLeaked(logged, CANARY_SECRET);
      assertNotLeaked((error as Error).message, CANARY_SECRET);
    });
  });

  describe('stream', () => {
    it('yields the text fragments in order and skips empty ones', async () => {
      const words = [
        faker.lorem.word(),
        faker.lorem.word(),
        faker.lorem.word(),
      ];
      server.on('POST', '/api/chat', (_req, res) =>
        respondNdjson(
          res,
          [
            ...words.map((content) =>
              ollamaChatChunkFactory.build({ message: { content } }),
            ),
            ollamaChatChunkFactory.final().build(),
          ],
          5,
        ),
      );
      const { service } = serviceWith();

      await expect(collect(service.stream(messages()))).resolves.toEqual(words);
      expect(server.requestsTo('/api/chat')[0].body).toMatchObject({
        stream: true,
      });
    });

    it('reports a missing model', async () => {
      server.on('POST', '/api/chat', (_req, res) =>
        respondJson(res, 404, { error: 'model not found' }),
      );
      const { service } = serviceWith();

      await expect(collect(service.stream(messages()))).rejects.toBeInstanceOf(
        InferenceModelNotFoundError,
      );
    });

    it('fails when the model reports an error mid-stream', async () => {
      server.on('POST', '/api/chat', (_req, res) =>
        respondNdjson(res, [
          ollamaChatChunkFactory.build(),
          { error: 'out of memory' },
        ]),
      );
      const { service } = serviceWith();

      await expect(collect(service.stream(messages()))).rejects.toMatchObject({
        reason: 'invalid-response',
      });
    });

    it('fails on a line that is not JSON', async () => {
      server.on('POST', '/api/chat', (_req, res) =>
        respondLines(res, [
          JSON.stringify(ollamaChatChunkFactory.build()),
          'not json',
        ]),
      );
      const { service } = serviceWith();

      await expect(collect(service.stream(messages()))).rejects.toMatchObject({
        name: 'InferenceUnavailableError',
        reason: 'invalid-response',
      });
    });

    it('stops the request when the caller aborts', async () => {
      let closed: Promise<void> | undefined;
      server.on('POST', '/api/chat', (_req, res) => {
        closed = new Promise((resolve) => res.on('close', () => resolve()));
        res.writeHead(200);
        res.write(`${JSON.stringify(ollamaChatChunkFactory.build())}\n`);
      });
      const { service } = serviceWith();
      const controller = new AbortController();

      const received: string[] = [];
      const consume = (async () => {
        for await (const fragment of service.stream(messages(), {
          signal: controller.signal,
        })) {
          received.push(fragment);
          controller.abort();
        }
      })();

      const error = await consume.catch((e: unknown) => e);
      expect(received).toHaveLength(1);
      expect(error).not.toBeInstanceOf(InferenceUnavailableError);
      await expect(closed).resolves.toBeUndefined();
    });
  });
});
