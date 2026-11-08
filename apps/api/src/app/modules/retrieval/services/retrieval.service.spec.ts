import { Logger } from '@nestjs/common';
import { testConfig } from '@codebase-ai/server-testing';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import { InferenceUnavailableError } from '../../inference/errors/inference-unavailable.error';
import type { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import { searchCandidateFactory } from '../../../../testing/factories/search-candidate.factory';
import { LexicalSearchService } from './lexical-search.service';
import { RetrievalService } from './retrieval.service';
import { VectorSearchService } from './vector-search.service';

describe('RetrievalService', () => {
  const config = testConfig({
    RETRIEVAL_MAX_CHUNKS: '2',
    RETRIEVAL_CANDIDATE_LIMIT: '5',
  });
  const identity = faker.lorem.slug();
  const vector = [0.1, 0.2];

  const embeddings = {
    identity,
    embedQuery: jest.fn(),
  };
  const vectorSearch = { search: jest.fn() };
  const lexicalSearch = { search: jest.fn() };

  const service = () =>
    new RetrievalService(
      embeddings as unknown as EmbeddingsService,
      vectorSearch as unknown as VectorSearchService,
      lexicalSearch as unknown as LexicalSearchService,
      config,
    );

  beforeEach(() => {
    embeddings.embedQuery.mockReset().mockResolvedValue(vector);
    vectorSearch.search.mockReset().mockResolvedValue([]);
    lexicalSearch.search.mockReset().mockResolvedValue([]);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['no repositories', 'a query', []],
    ['a blank query', '   ', [faker.string.uuid()]],
  ])('does no work for %s', async (_label, query, repositoryIds) => {
    await expect(service().search({ query, repositoryIds })).resolves.toEqual(
      [],
    );
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(vectorSearch.search).not.toHaveBeenCalled();
    expect(lexicalSearch.search).not.toHaveBeenCalled();
  });

  it('searches the unique ids with the embedded query and the embedding identity', async () => {
    const id = faker.string.uuid();

    await service().search({ query: '  find it  ', repositoryIds: [id, id] });

    expect(embeddings.embedQuery).toHaveBeenCalledWith('find it', {});
    expect(vectorSearch.search).toHaveBeenCalledWith({
      vector,
      repositoryIds: [id],
      embeddingModel: identity,
    });
    expect(lexicalSearch.search).toHaveBeenCalledWith('find it', [id]);
  });

  it('fuses both searches and applies the chunk limit', async () => {
    const [both, vectorOnly, lexicalOnly] = searchCandidateFactory.buildList(3);
    vectorSearch.search.mockResolvedValue([both, vectorOnly]);
    lexicalSearch.search.mockResolvedValue([both, lexicalOnly]);

    const results = await service().search({
      query: 'q',
      repositoryIds: [faker.string.uuid()],
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      chunkId: both.chunkId,
      sources: ['vector', 'lexical'],
    });
  });

  it('fails instead of falling back when inference is unavailable', async () => {
    embeddings.embedQuery.mockRejectedValue(
      new InferenceUnavailableError('network'),
    );

    await expect(
      service().search({ query: 'q', repositoryIds: [faker.string.uuid()] }),
    ).rejects.toBeInstanceOf(InferenceUnavailableError);
    expect(vectorSearch.search).not.toHaveBeenCalled();
    expect(lexicalSearch.search).not.toHaveBeenCalled();
  });

  it('logs counts and timing but never the query', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const candidate = searchCandidateFactory.build();
    vectorSearch.search.mockResolvedValue([candidate]);

    await service().search({
      query: `password = "${CANARY_SECRET}"`,
      repositoryIds: [faker.string.uuid()],
    });

    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toMatch(
      /repositories=1 vector=1 lexical=0 results=1 \d+ms/,
    );
    assertNotLeaked(log.mock.calls, CANARY_SECRET);
    assertNotLeaked(log.mock.calls, candidate.content);
  });
});
