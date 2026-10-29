import { EMBEDDING_DIMENSIONS } from '@codebase-ai/server-database';
import { buildEmbeddingVectors, testConfig } from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { InferenceModelNotFoundError } from '../../inference/errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../../inference/errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../../inference/errors/inference-unavailable.error';
import type { EmbeddingPort } from '../../inference/types/embedding-port';
import { EmbeddingDimensionMismatchError } from '../errors/embedding-dimension-mismatch.error';
import { EmbeddingsService } from './embeddings.service';

const DIMENSIONS = 8;

const vectors = (count: number, dimensions = DIMENSIONS): number[][] =>
  buildEmbeddingVectors(count, dimensions);

describe('EmbeddingsService', () => {
  const configWith = (env: Record<string, string> = {}) =>
    testConfig({ EMBEDDING_DIMENSIONS: String(DIMENSIONS), ...env });

  const serviceWith = (
    embedBatch: EmbeddingPort['embedBatch'],
    env: Record<string, string> = {},
  ) => {
    const port = { embedBatch: jest.fn(embedBatch) };
    return { port, service: new EmbeddingsService(port, configWith(env)) };
  };

  it('defaults to the dimension of the database column', () => {
    expect(testConfig().inference.embeddingDimensions).toBe(
      EMBEDDING_DIMENSIONS,
    );
  });

  it('splits inputs into batches and keeps their order', async () => {
    const { port, service } = serviceWith(
      async (texts) =>
        texts.map((text) =>
          Array.from({ length: DIMENSIONS }, () => text.length),
        ),
      { EMBEDDING_BATCH_SIZE: '2' },
    );

    const result = await service.embed(['a', 'bb', 'ccc', 'dddd', 'eeeee']);

    expect(port.embedBatch.mock.calls.map(([texts]) => texts)).toEqual([
      ['a', 'bb'],
      ['ccc', 'dddd'],
      ['eeeee'],
    ]);
    expect(result.map((vector) => vector[0])).toEqual([1, 2, 3, 4, 5]);
  });

  it('identifies vectors by runtime and model', () => {
    const model = faker.lorem.slug();
    const { service } = serviceWith(async () => [], {
      EMBEDDING_MODEL: model,
    });
    expect(service.identity).toBe(`${configWith().inference.runtime}/${model}`);
  });

  it('makes no call for an empty input', async () => {
    const { port, service } = serviceWith(async () => []);
    await expect(service.embed([])).resolves.toEqual([]);
    expect(port.embedBatch).not.toHaveBeenCalled();
  });

  it.each(['network', 'timeout', 'server-error'] as const)(
    'retries a %s failure and then succeeds',
    async (reason) => {
      let calls = 0;
      const { port, service } = serviceWith(async (texts) => {
        calls++;
        if (calls === 1) throw new InferenceUnavailableError(reason);
        return vectors(texts.length);
      });

      await expect(service.embed([faker.lorem.word()])).resolves.toHaveLength(
        1,
      );
      expect(port.embedBatch).toHaveBeenCalledTimes(2);
    },
  );

  it('stops after the configured number of retries', async () => {
    const { port, service } = serviceWith(
      async () => {
        throw new InferenceUnavailableError('server-error');
      },
      { INFERENCE_MAX_RETRIES: '2' },
    );

    await expect(service.embed([faker.lorem.word()])).rejects.toBeInstanceOf(
      InferenceUnavailableError,
    );
    expect(port.embedBatch).toHaveBeenCalledTimes(3);
  });

  it('does not retry when retries are disabled', async () => {
    const { port, service } = serviceWith(
      async () => {
        throw new InferenceUnavailableError('network');
      },
      { INFERENCE_MAX_RETRIES: '0' },
    );

    await expect(service.embed([faker.lorem.word()])).rejects.toBeDefined();
    expect(port.embedBatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a rejected request', new InferenceRequestRejectedError(400)],
    ['a missing model', new InferenceModelNotFoundError(faker.lorem.word())],
    ['an invalid response', new InferenceUnavailableError('invalid-response')],
  ])('does not retry %s', async (_label, failure) => {
    const { port, service } = serviceWith(async () => {
      throw failure;
    });

    await expect(service.embed([faker.lorem.word()])).rejects.toBe(failure);
    expect(port.embedBatch).toHaveBeenCalledTimes(1);
  });

  it('raises an error when the vector dimension differs from the config', async () => {
    const { port, service } = serviceWith(async () =>
      vectors(1, DIMENSIONS + 1),
    );

    const error = await service
      .embed([faker.lorem.word()])
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmbeddingDimensionMismatchError);
    expect(error).toMatchObject({
      expected: DIMENSIONS,
      actual: DIMENSIONS + 1,
    });
    expect(port.embedBatch).toHaveBeenCalledTimes(1);
  });

  it('rejects a response with the wrong number of vectors', async () => {
    const { service } = serviceWith(async () => vectors(1));

    await expect(
      service.embed([faker.lorem.word(), faker.lorem.word()]),
    ).rejects.toMatchObject({ reason: 'invalid-response' });
  });

  it('does not retry once the caller aborted', async () => {
    const controller = new AbortController();
    const { port, service } = serviceWith(async () => {
      controller.abort();
      throw new InferenceUnavailableError('network');
    });

    await expect(
      service.embed([faker.lorem.word()], { signal: controller.signal }),
    ).rejects.toBeDefined();
    expect(port.embedBatch).toHaveBeenCalledTimes(1);
  });

  it('passes the caller signal to the port', async () => {
    const signal = new AbortController().signal;
    const { port, service } = serviceWith(async (texts) =>
      vectors(texts.length),
    );

    await service.embed(['x'], { signal });
    expect(port.embedBatch).toHaveBeenCalledWith(['x'], { signal });
  });
});
