import { Logger } from '@nestjs/common';
import {
  FakeLoopbackServer,
  ollamaEmbedResponseFactory,
  respondJson,
  testConfig,
} from '@codebase-ai/server-testing';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import { InferenceModelNotFoundError } from '../../errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../../errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../../errors/inference-unavailable.error';
import { OllamaEmbedding } from './ollama-embedding';

describe('OllamaEmbedding', () => {
  let server: FakeLoopbackServer;
  let adapter: OllamaEmbedding;
  let model: string;

  beforeEach(async () => {
    server = await FakeLoopbackServer.start();
    const config = testConfig({ INFERENCE_BASE_URL: server.baseUrl });
    model = config.inference.embeddingModel;
    adapter = new OllamaEmbedding(
      new EgressHttpClient({ origin: server.baseUrl }, config),
      config,
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await server.stop();
  });

  it('posts the batch to /api/embed with the configured model and no truncation', async () => {
    const texts = [faker.lorem.sentence(), faker.lorem.sentence()];
    const response = ollamaEmbedResponseFactory.build(
      {},
      { transient: { count: texts.length, dimensions: 4 } },
    );
    server.on('POST', '/api/embed', (_req, res) =>
      respondJson(res, 200, response),
    );

    await expect(adapter.embedBatch(texts)).resolves.toEqual(
      response.embeddings,
    );
    expect(server.requestsTo('/api/embed')[0].body).toEqual({
      model,
      input: texts,
      truncate: false,
    });
  });

  it.each([
    ['no embeddings field', {}],
    ['a non-array', { embeddings: 'x' }],
    ['a non-numeric component', { embeddings: [[0.1, 'x']] }],
  ])('rejects a response with %s', async (_label, body) => {
    server.on('POST', '/api/embed', (_req, res) => respondJson(res, 200, body));

    await expect(adapter.embedBatch(['x'])).rejects.toMatchObject({
      name: 'InferenceUnavailableError',
      reason: 'invalid-response',
    });
  });

  it('maps 404 to a missing model', async () => {
    server.on('POST', '/api/embed', (_req, res) =>
      respondJson(res, 404, { error: 'model not found' }),
    );

    const error = await adapter.embedBatch(['x']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InferenceModelNotFoundError);
    expect(error).toMatchObject({ model });
  });

  it('maps another 4xx to a rejected request', async () => {
    server.on('POST', '/api/embed', (_req, res) => respondJson(res, 400, {}));

    await expect(adapter.embedBatch(['x'])).rejects.toBeInstanceOf(
      InferenceRequestRejectedError,
    );
  });

  it('maps 5xx to a retryable server error', async () => {
    server.on('POST', '/api/embed', (_req, res) => respondJson(res, 500, {}));

    const error = await adapter.embedBatch(['x']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InferenceUnavailableError);
    expect(error).toMatchObject({ reason: 'server-error', retryable: true });
  });

  it('sends one request only to the configured origin when the server is down', async () => {
    await server.stop();
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(adapter.embedBatch(['x'])).rejects.toMatchObject({
      name: 'InferenceUnavailableError',
      reason: 'network',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchSpy.mock.calls[0][0])).origin).toBe(
      server.baseUrl,
    );
    server = await FakeLoopbackServer.start();
  });

  it('never logs or leaks the input text on failure', async () => {
    const logged: unknown[] = [];
    for (const level of ['debug', 'log', 'warn', 'error', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logged.push(args);
        });
    }
    server.on('POST', '/api/embed', (_req, res) =>
      respondJson(res, 500, { error: CANARY_SECRET }),
    );

    const error = await adapter
      .embedBatch([CANARY_SECRET])
      .catch((e: unknown) => e);

    expect(logged.length).toBeGreaterThan(0);
    assertNotLeaked(logged, CANARY_SECRET);
    assertNotLeaked((error as Error).message, CANARY_SECRET);
  });
});
