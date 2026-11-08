import type { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { SearchResponse } from '@codebase-ai/contracts';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  axisVector,
  codeChunkFactory,
  describeWithDatabase,
  prepareDedicatedDatabase,
  type RepositoryRow,
  repositoryFactory,
  repositoryFileFactory,
} from '@codebase-ai/server-database/testing';
import { testConfig } from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';
import { EmbeddingsService } from '../embeddings/services/embeddings.service';
import { EMBEDDING_PORT } from '../inference/types/embedding-port';
import { searchTermsFor } from '../ingestion/utils/identifier-terms';
import { RetrievalService } from './services/retrieval.service';

const { codeChunks, repositories, repositoryFiles } = schema;

const MAX_CHUNKS = 5;
const MAX_CONTEXT_CHARS = 2500;
const CANDIDATE_LIMIT = 10;
const QUERY_AXIS = 0;

describeWithDatabase('hybrid retrieval', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let retrieval: RetrievalService;
  let identity: string;

  const create = () => ({ transient: { db: handle.db } });
  const newRepository = () => repositoryFactory.create({}, create());

  const seedFile = (repo: RepositoryRow, relativePath?: string) =>
    repositoryFileFactory.create(
      { repositoryId: repo.id, ...(relativePath ? { relativePath } : {}) },
      create(),
    );

  interface ChunkSeed {
    content: string;
    symbolName?: string | null;
    /** Defaults to the query direction, so the chunk is the nearest vector match. */
    axis?: number;
    startLine?: number;
    endLine?: number;
    embeddingModel?: string;
  }

  const seedChunk = async (
    repo: RepositoryRow,
    seed: ChunkSeed,
    file?: { id: string },
  ) => {
    const targetFile = file ?? (await seedFile(repo));
    const symbolName = seed.symbolName ?? null;
    return codeChunkFactory.create(
      {
        repositoryId: repo.id,
        fileId: targetFile.id,
        symbolName,
        content: seed.content,
        searchTerms: searchTermsFor(`${symbolName ?? ''}\n${seed.content}`),
        embedding: axisVector(seed.axis ?? QUERY_AXIS),
        embeddingModel: seed.embeddingModel ?? identity,
        ...(seed.startLine !== undefined && { startLine: seed.startLine }),
        ...(seed.endLine !== undefined && { endLine: seed.endLine }),
      },
      create(),
    );
  };

  /** Fills the vector candidate list with chunks nearer to the query than anything the test cares about. */
  const seedDistractors = async (repo: RepositoryRow, count: number) => {
    for (let index = 0; index < count; index++) {
      await seedChunk(repo, {
        content: `export const filler${index} = ${index};`,
      });
    }
  };

  const search = (query: string, repositoryIds: string[]) =>
    retrieval.search({ query, repositoryIds });

  beforeAll(async () => {
    const prepared = await prepareDedicatedDatabase(baseUrl, 'retrieval');
    handle = prepared.handle;
    const config = testConfig({
      DATABASE_URL: prepared.url,
      RETRIEVAL_DEBUG_ENDPOINT: 'true',
      RETRIEVAL_MAX_CHUNKS: String(MAX_CHUNKS),
      RETRIEVAL_MAX_CONTEXT_CHARS: String(MAX_CONTEXT_CHARS),
      RETRIEVAL_CANDIDATE_LIMIT: String(CANDIDATE_LIMIT),
    });
    app = await createTestApp({
      config,
      overrides: [
        {
          provide: EMBEDDING_PORT,
          // Every query embeds to the query axis; stored vectors are placed relative to it.
          useValue: {
            embedBatch: async (texts: readonly string[]) =>
              texts.map(() => axisVector(QUERY_AXIS)),
          },
        },
      ],
    });
    retrieval = app.get(RetrievalService, { strict: false });
    identity = app.get(EmbeddingsService, { strict: false }).identity;
  });

  afterEach(async () => {
    await handle.db.delete(repositories);
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
  });

  describe('repository scope', () => {
    const identifier = 'computeInvoiceTotal';
    const content = `export function ${identifier}(items: number[]): number { return items.length; }`;

    it('never returns chunks from a repository that was not selected', async () => {
      const repoA = await newRepository();
      const repoB = await newRepository();
      // Repository B holds the nearest vector and the exact identifier, so only the filter can keep it out.
      await seedChunk(repoA, { content, axis: 3 });
      await seedChunk(repoB, { content });

      const scopedToA = await search(identifier, [repoA.id]);
      const scopedToB = await search(identifier, [repoB.id]);
      const both = await search(identifier, [repoA.id, repoB.id]);

      expect(scopedToA.map((chunk) => chunk.repositoryId)).toEqual([repoA.id]);
      expect(scopedToB.map((chunk) => chunk.repositoryId)).toEqual([repoB.id]);
      expect(new Set(both.map((chunk) => chunk.repositoryId))).toEqual(
        new Set([repoA.id, repoB.id]),
      );
    });

    it('returns nothing for no ids or unknown ids', async () => {
      const repo = await newRepository();
      await seedChunk(repo, { content });

      await expect(search(identifier, [])).resolves.toEqual([]);
      await expect(
        search(identifier, [faker.string.uuid(), faker.string.uuid()]),
      ).resolves.toEqual([]);
    });

    it.each([
      ["'; drop table code_chunks; --", 'quote and comment'],
      ['a & b | !c <-> d:* ((', 'tsquery operators'],
      ["x') OR repository_id IS NOT NULL --", 'boolean injection'],
      ['\\', 'backslash'],
    ])('treats %s as plain text (%s)', async (hostile) => {
      const repoA = await newRepository();
      const repoB = await newRepository();
      await seedChunk(repoA, { content: 'export const alpha = 1;' });
      await seedChunk(repoB, { content: `const beta = "${hostile}";` });

      const results = await search(hostile, [repoA.id]);

      expect(results.every((chunk) => chunk.repositoryId === repoA.id)).toBe(
        true,
      );
      const [{ chunks }] = (
        await handle.db.execute<{ chunks: number }>(
          sql`select count(*)::int as chunks from code_chunks`,
        )
      ).rows;
      expect(chunks).toBe(2);
    });
  });

  describe('lexical search', () => {
    it('finds an exact identifier that vector search ranks out of reach', async () => {
      const repo = await newRepository();
      await seedDistractors(repo, CANDIDATE_LIMIT + 2);
      const target = await seedChunk(repo, {
        content: 'export function computeInvoiceTotal(items: number[]) {}',
        axis: 7,
      });

      const results = await search('computeInvoiceTotal', [repo.id]);

      // Vector candidates tie with it at the top, so locate it by id.
      expect(
        results.find((chunk) => chunk.chunkId === target.id),
      ).toMatchObject({
        sources: ['lexical'],
        lexicalRank: 1,
      });
    });

    it.each([
      [
        'a snake_case name by its camelCase spelling',
        'parseHttpResponse',
        'function parse_http_response(raw) {}',
      ],
      [
        'a member inside a dotted call',
        'findOne',
        'return this.userService.findOne(id);',
      ],
      [
        'a part of a camelCase name',
        'invoice',
        'export function computeInvoiceTotal() {}',
      ],
    ])('finds %s', async (_label, query, content) => {
      const repo = await newRepository();
      await seedDistractors(repo, CANDIDATE_LIMIT + 2);
      const target = await seedChunk(repo, { content, axis: 7 });

      const results = await search(query, [repo.id]);

      expect(results.map((chunk) => chunk.chunkId)).toContain(target.id);
      expect(
        results.find((chunk) => chunk.chunkId === target.id)?.sources,
      ).toContain('lexical');
    });

    it('ranks an exact phrase above the same words scattered', async () => {
      const repo = await newRepository();
      await seedDistractors(repo, CANDIDATE_LIMIT + 2);
      const exact = await seedChunk(repo, {
        content: "throw new Error('connection refused by upstream host');",
        axis: 7,
      });
      const scattered = await seedChunk(repo, {
        content:
          'host list; upstream by region; refused count; connection pool size',
        axis: 8,
      });

      const results = await search('connection refused by upstream host', [
        repo.id,
      ]);

      expect(
        results.find((chunk) => chunk.chunkId === exact.id)?.lexicalRank,
      ).toBe(1);
      expect(
        results.find((chunk) => chunk.chunkId === scattered.id)?.lexicalRank,
      ).toBe(2);
    });
  });

  describe('vector search', () => {
    it('finds a paraphrase that shares no words with the chunk', async () => {
      const repo = await newRepository();
      const target = await seedChunk(repo, {
        content: 'export function sumLineItems(items) { return items.length; }',
      });
      await seedChunk(repo, {
        content: 'export const unrelated = 1;',
        axis: 5,
      });

      const results = await search('how are amounts added together', [repo.id]);

      expect(results[0]).toMatchObject({
        chunkId: target.id,
        sources: ['vector'],
        vectorRank: 1,
      });
      expect(results[0].lexicalRank).toBeUndefined();
    });

    it('ignores vectors from another embedding identity', async () => {
      const repo = await newRepository();
      await seedChunk(repo, {
        content: 'export function sumLineItems(items) {}',
        embeddingModel: 'other-runtime/other-model',
      });

      await expect(
        search('how are amounts added together', [repo.id]),
      ).resolves.toEqual([]);
    });
  });

  describe('context budget', () => {
    it('limits the number of chunks', async () => {
      const repo = await newRepository();
      await seedDistractors(repo, MAX_CHUNKS + 3);

      const results = await search('anything about fillers', [repo.id]);

      expect(results).toHaveLength(MAX_CHUNKS);
    });

    it('limits the characters of content', async () => {
      const repo = await newRepository();
      for (let index = 0; index < 5; index++) {
        await seedChunk(repo, { content: `${'x'.repeat(1000)} part${index}` });
      }

      const results = await search('unrelated question', [repo.id]);

      const characters = results.reduce(
        (total, chunk) => total + chunk.content.length,
        0,
      );
      expect(results.length).toBeGreaterThan(0);
      expect(characters).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    });

    it('returns one of two overlapping chunks from the same file', async () => {
      const repo = await newRepository();
      const file = await seedFile(repo);
      const first = await seedChunk(
        repo,
        { content: 'export function overlap() {}', startLine: 1, endLine: 30 },
        file,
      );
      await seedChunk(
        repo,
        {
          content: 'export function other() { return 1; }',
          startLine: 25,
          endLine: 60,
          axis: 4,
        },
        file,
      );

      const results = await search('overlap', [repo.id]);

      expect(results.map((chunk) => chunk.chunkId)).toEqual([first.id]);
    });
  });

  describe('provenance', () => {
    it('cites the repository, file and line range stored for each chunk', async () => {
      const repo = await newRepository();
      await seedChunk(repo, {
        content: 'export function computeInvoiceTotal() {}',
        symbolName: 'computeInvoiceTotal',
        startLine: 12,
        endLine: 40,
      });
      await seedDistractors(repo, 2);

      const results = await search('computeInvoiceTotal', [repo.id]);

      expect(results.length).toBeGreaterThan(1);
      for (const result of results) {
        const [stored] = await handle.db
          .select({
            repositoryName: repositories.name,
            relativePath: repositoryFiles.relativePath,
            startLine: codeChunks.startLine,
            endLine: codeChunks.endLine,
            symbolName: codeChunks.symbolName,
            content: codeChunks.content,
          })
          .from(codeChunks)
          .innerJoin(repositoryFiles, eq(repositoryFiles.id, codeChunks.fileId))
          .innerJoin(repositories, eq(repositories.id, codeChunks.repositoryId))
          .where(eq(codeChunks.id, result.chunkId));
        expect(stored).toBeDefined();
        expect(result).toMatchObject({ ...stored, repositoryId: repo.id });
        expect(result.startLine).toBeGreaterThanOrEqual(1);
        expect(result.endLine).toBeGreaterThanOrEqual(result.startLine);
      }
    });
  });

  describe('POST /search', () => {
    it('returns the fused results with their provenance', async () => {
      const repo = await newRepository();
      const target = await seedChunk(repo, {
        content: 'export function computeInvoiceTotal() {}',
        symbolName: 'computeInvoiceTotal',
      });

      const response = await authorizedAgent(app)
        .post('/search')
        .send({ query: 'computeInvoiceTotal', repositoryIds: [repo.id] })
        .expect(200);

      const body = response.body as SearchResponse;
      expect(body.results).toHaveLength(1);
      expect(body.results[0]).toMatchObject({
        chunkId: target.id,
        repositoryId: repo.id,
        repositoryName: repo.name,
        symbolName: 'computeInvoiceTotal',
        sources: ['vector', 'lexical'],
        vectorRank: 1,
        lexicalRank: 1,
      });
    });
  });
});
