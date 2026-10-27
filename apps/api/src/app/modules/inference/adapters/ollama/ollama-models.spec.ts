import {
  FakeLoopbackServer,
  ollamaTagsResponseFactory,
  respondJson,
  testConfig,
} from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import { InferenceUnavailableError } from '../../errors/inference-unavailable.error';
import { OllamaModels } from './ollama-models';

describe('OllamaModels', () => {
  let server: FakeLoopbackServer;
  let adapter: OllamaModels;

  const pulled = (names: string[]) =>
    server.on('GET', '/api/tags', (_req, res) =>
      respondJson(
        res,
        200,
        ollamaTagsResponseFactory.build({}, { transient: { names } }),
      ),
    );

  beforeEach(async () => {
    server = await FakeLoopbackServer.start();
    const config = testConfig({ INFERENCE_BASE_URL: server.baseUrl });
    adapter = new OllamaModels(
      new EgressHttpClient({ origin: server.baseUrl }, config),
    );
  });

  afterEach(async () => {
    await server.stop();
  });

  it('reports availability per model in input order', async () => {
    const present = `${faker.lorem.word()}:7b`;
    const missing = `${faker.lorem.word()}-missing:7b`;
    pulled([present]);

    await expect(adapter.availableModels([missing, present])).resolves.toEqual([
      false,
      true,
    ]);
  });

  it('matches an untagged name to its :latest tag only', async () => {
    const name = faker.lorem.word();
    pulled([`${name}:latest`]);

    await expect(
      adapter.availableModels([name, `${name}:latest`, `${name}:7b`]),
    ).resolves.toEqual([true, true, false]);
  });

  it('treats a malformed tag list as no models', async () => {
    server.on('GET', '/api/tags', (_req, res) => respondJson(res, 200, {}));

    await expect(adapter.availableModels(['x'])).resolves.toEqual([false]);
  });

  it('throws an inference error when the runtime is unreachable', async () => {
    await server.stop();

    await expect(adapter.availableModels(['x'])).rejects.toBeInstanceOf(
      InferenceUnavailableError,
    );
    server = await FakeLoopbackServer.start();
  });
});
