import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { SearchResponse } from '@codebase-ai/contracts';
import { testConfig } from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../../testing/authorized-agent';
import { createTestApp } from '../../../../testing/create-test-app';
import { retrievedChunkFactory } from '../../../../testing/factories/search-candidate.factory';
import { ProjectScopeService } from '../../projects/services/project-scope.service';
import { RetrievalService } from '../services/retrieval.service';

describe('SearchController', () => {
  // Every test boots the whole app, which can take over 5s during a parallel coverage run.
  jest.setTimeout(30_000);

  const search = jest.fn();
  const resolveSourceIds = jest.fn();
  let app: INestApplication | undefined;

  const start = async (env: Record<string, string>) => {
    app = await createTestApp({
      config: testConfig(env),
      overrides: [
        { provide: RetrievalService, useValue: { search } },
        { provide: ProjectScopeService, useValue: { resolveSourceIds } },
      ],
    });
    return app;
  };

  const validBody = () => ({
    query: faker.lorem.sentence(),
    sourceIds: [faker.string.uuid()],
  });

  beforeEach(() => {
    search.mockReset().mockResolvedValue([]);
    resolveSourceIds.mockReset();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('when the debug endpoint is disabled', () => {
    it('answers 404 to an authorized request', async () => {
      await authorizedAgent(await start({}))
        .post('/search')
        .send(validBody())
        .expect(404);
      expect(search).not.toHaveBeenCalled();
    });

    it('still answers 401 without a token, so its existence is not revealed', async () => {
      const server = (await start({})).getHttpServer();
      await request(server).post('/search').send(validBody()).expect(401);
    });
  });

  describe('when the debug endpoint is enabled', () => {
    const enabled = { RETRIEVAL_DEBUG_ENDPOINT: 'true' };

    it('requires the token', async () => {
      const server = (await start(enabled)).getHttpServer();
      await request(server).post('/search').send(validBody()).expect(401);
      expect(search).not.toHaveBeenCalled();
    });

    it('searches with the trimmed query and returns the mapped results', async () => {
      const chunk = retrievedChunkFactory.build({
        sources: ['vector', 'lexical'],
        vectorRank: 2,
        lexicalRank: 1,
      });
      search.mockResolvedValue([chunk]);
      const body = validBody();

      const response = await authorizedAgent(await start(enabled))
        .post('/search')
        .send({ ...body, query: `  ${body.query}  ` })
        .expect(200);

      expect(search).toHaveBeenCalledWith(body);
      expect((response.body as SearchResponse).results).toEqual([
        { ...chunk, vectorRank: 2, lexicalRank: 1 },
      ]);
    });

    it('searches the sources of a project', async () => {
      const projectId = faker.string.uuid();
      const sourceIds = [faker.string.uuid(), faker.string.uuid()];
      resolveSourceIds.mockResolvedValue(sourceIds);
      const query = faker.lorem.sentence();

      await authorizedAgent(await start(enabled))
        .post('/search')
        .send({ query, projectId })
        .expect(200);

      expect(resolveSourceIds).toHaveBeenCalledWith(projectId);
      expect(search).toHaveBeenCalledWith({ query, sourceIds });
    });

    it('reports a missing rank as null', async () => {
      search.mockResolvedValue([retrievedChunkFactory.build()]);

      const response = await authorizedAgent(await start(enabled))
        .post('/search')
        .send(validBody())
        .expect(200);

      expect((response.body as SearchResponse).results[0]).toMatchObject({
        vectorRank: null,
        lexicalRank: null,
      });
    });

    it.each([
      ['no query', { sourceIds: [faker.string.uuid()] }],
      ['a blank query', { query: '   ', sourceIds: [faker.string.uuid()] }],
      [
        'a query over 2000 characters',
        { query: 'a'.repeat(2001), sourceIds: [faker.string.uuid()] },
      ],
      ['no scope', { query: 'x' }],
      [
        'both sources and a project',
        { ...validBody(), projectId: faker.string.uuid() },
      ],
      ['an invalid project id', { query: 'x', projectId: 'nope' }],
      ['an empty source list', { query: 'x', sourceIds: [] }],
      ['an invalid source id', { query: 'x', sourceIds: ['nope'] }],
      [
        'more than 20 sources',
        {
          query: 'x',
          sourceIds: Array.from({ length: 21 }, () => faker.string.uuid()),
        },
      ],
      [
        'a repeated source id',
        {
          query: 'x',
          sourceIds: Array(2).fill('2f0c2b6e-6c5b-4a43-9d0b-6a3a2c1f9e11'),
        },
      ],
      ['an extra property', { ...validBody(), provider: 'remote' }],
    ])('rejects %s with 400', async (_label, body) => {
      await authorizedAgent(await start(enabled))
        .post('/search')
        .send(body)
        .expect(400);
      expect(search).not.toHaveBeenCalled();
      expect(resolveSourceIds).not.toHaveBeenCalled();
    });
  });
});
