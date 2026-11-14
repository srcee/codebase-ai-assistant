import type { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { SearchResponse } from '@codebase-ai/contracts';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  axisVector,
  chunkFactory,
  describeWithDatabase,
  prepareDedicatedDatabase,
  projectFactory,
  projectSourceFactory,
  sourceFactory,
  sourceFileFactory,
  type SourceRow,
} from '@codebase-ai/server-database/testing';
import { testConfig } from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';
import { EmbeddingsService } from '../embeddings/services/embeddings.service';
import { EMBEDDING_PORT } from '../inference/types/embedding-port';
import { searchTermsFor } from '../ingestion/utils/identifier-terms';
import { ProjectScopeService } from '../projects/services/project-scope.service';
import { RetrievalService } from './services/retrieval.service';

const { chunks, projects, sources, sourceFiles } = schema;

const MAX_CHUNKS = 5;
const MAX_CONTEXT_CHARS = 2500;
const CANDIDATE_LIMIT = 10;
const QUERY_AXIS = 0;

describeWithDatabase('hybrid retrieval', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let retrieval: RetrievalService;
  let projectScope: ProjectScopeService;
  let identity: string;

  const create = () => ({ transient: { db: handle.db } });
  const newRepository = () => sourceFactory.create({}, create());

  const seedFile = (repo: SourceRow, relativePath?: string) =>
    sourceFileFactory.create(
      { sourceId: repo.id, ...(relativePath ? { relativePath } : {}) },
      create(),
    );

  interface ChunkSeed {
    content: string;
    title?: string | null;
    /** Defaults to the query direction, so the chunk is the nearest vector match. */
    axis?: number;
    startLine?: number;
    endLine?: number;
    embeddingModel?: string;
  }

  const seedChunk = async (
    repo: SourceRow,
    seed: ChunkSeed,
    file?: { id: string },
  ) => {
    const targetFile = file ?? (await seedFile(repo));
    const title = seed.title ?? null;
    const startLine = seed.startLine ?? faker.number.int({ min: 1, max: 100 });
    const endLine =
      seed.endLine ?? startLine + faker.number.int({ min: 0, max: 40 });
    return chunkFactory.create(
      {
        sourceId: repo.id,
        fileId: targetFile.id,
        title,
        content: seed.content,
        searchTerms: searchTermsFor(`${title ?? ''}\n${seed.content}`),
        embedding: axisVector(seed.axis ?? QUERY_AXIS),
        embeddingModel: seed.embeddingModel ?? identity,
        startLine,
        endLine,
        locator: { kind: 'lines', startLine, endLine },
      },
      create(),
    );
  };

  /** Fills the vector candidate list with chunks nearer to the query than anything the test cares about. */
  const seedDistractors = async (repo: SourceRow, count: number) => {
    for (let index = 0; index < count; index++) {
      await seedChunk(repo, {
        content: `export const filler${index} = ${index};`,
      });
    }
  };

  const search = (query: string, sourceIds: string[]) =>
    retrieval.search({ query, sourceIds });

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
    projectScope = app.get(ProjectScopeService, { strict: false });
    identity = app.get(EmbeddingsService, { strict: false }).identity;
  });

  afterEach(async () => {
    await handle.db.delete(projects);
    await handle.db.delete(sources);
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
  });

  describe('source scope', () => {
    const identifier = 'computeInvoiceTotal';
    const content = `export function ${identifier}(items: number[]): number { return items.length; }`;

    it('never returns chunks from a source that was not selected', async () => {
      const repoA = await newRepository();
      const repoB = await newRepository();
      // Source B holds the nearest vector and the exact identifier, so only the filter can keep it out.
      await seedChunk(repoA, { content, axis: 3 });
      await seedChunk(repoB, { content });

      const scopedToA = await search(identifier, [repoA.id]);
      const scopedToB = await search(identifier, [repoB.id]);
      const both = await search(identifier, [repoA.id, repoB.id]);

      expect(scopedToA.map((chunk) => chunk.sourceId)).toEqual([repoA.id]);
      expect(scopedToB.map((chunk) => chunk.sourceId)).toEqual([repoB.id]);
      expect(new Set(both.map((chunk) => chunk.sourceId))).toEqual(
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
      ["'; drop table chunks; --", 'quote and comment'],
      ['a & b | !c <-> d:* ((', 'tsquery operators'],
      ["x') OR source_id IS NOT NULL --", 'boolean injection'],
      ['\\', 'backslash'],
    ])('treats %s as plain text (%s)', async (hostile) => {
      const repoA = await newRepository();
      const repoB = await newRepository();
      await seedChunk(repoA, { content: 'export const alpha = 1;' });
      await seedChunk(repoB, { content: `const beta = "${hostile}";` });

      const results = await search(hostile, [repoA.id]);

      expect(results.every((chunk) => chunk.sourceId === repoA.id)).toBe(true);
      const [{ count }] = (
        await handle.db.execute<{ count: number }>(
          sql`select count(*)::int as count from chunks`,
        )
      ).rows;
      expect(count).toBe(2);
    });
  });

  describe('project scope', () => {
    const identifier = 'computeInvoiceTotal';
    const content = `export function ${identifier}() {}`;

    const newProject = async (...members: SourceRow[]) => {
      const project = await projectFactory.create({}, create());
      for (const member of members) {
        await projectSourceFactory.create(
          { projectId: project.id, sourceId: member.id },
          create(),
        );
      }
      return project;
    };

    const searchProject = async (projectId: string) =>
      search(identifier, await projectScope.resolveSourceIds(projectId));

    it('never returns chunks of a source that shares a different project', async () => {
      const repoA = await newRepository();
      const repoB = await newRepository();
      await seedChunk(repoA, { content, axis: 3 });
      await seedChunk(repoB, { content });
      const onlyA = await newProject(repoA);
      await newProject(repoA, repoB);

      const results = await searchProject(onlyA.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((chunk) => chunk.sourceId === repoA.id)).toBe(true);
    });

    it('returns nothing for an empty project', async () => {
      const repo = await newRepository();
      await seedChunk(repo, { content });
      const empty = await newProject();

      await expect(searchProject(empty.id)).resolves.toEqual([]);
    });

    it('keeps sources and chunks when a project is deleted', async () => {
      const repo = await newRepository();
      await seedChunk(repo, { content });
      const project = await newProject(repo);

      await handle.db.delete(projects).where(eq(projects.id, project.id));

      expect(await handle.db.select().from(sources)).toHaveLength(1);
      expect(await search(identifier, [repo.id])).toHaveLength(1);
    });

    it('drops a deleted source from its projects', async () => {
      const kept = await newRepository();
      const removed = await newRepository();
      await seedChunk(kept, { content, axis: 3 });
      await seedChunk(removed, { content });
      const project = await newProject(kept, removed);

      await handle.db.delete(sources).where(eq(sources.id, removed.id));

      expect(await projectScope.resolveSourceIds(project.id)).toEqual([
        kept.id,
      ]);
      const results = await searchProject(project.id);
      expect(results.map((chunk) => chunk.sourceId)).toEqual([kept.id]);
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
    it('cites the source, file and locator stored for each chunk', async () => {
      const repo = await newRepository();
      await seedChunk(repo, {
        content: 'export function computeInvoiceTotal() {}',
        title: 'computeInvoiceTotal',
        startLine: 12,
        endLine: 40,
      });
      await seedDistractors(repo, 2);

      const results = await search('computeInvoiceTotal', [repo.id]);

      expect(results.length).toBeGreaterThan(1);
      for (const result of results) {
        const [stored] = await handle.db
          .select({
            sourceName: sources.name,
            sourceKind: sources.kind,
            relativePath: sourceFiles.relativePath,
            title: chunks.title,
            contentKind: chunks.contentKind,
            locator: chunks.locator,
            content: chunks.content,
          })
          .from(chunks)
          .innerJoin(sourceFiles, eq(sourceFiles.id, chunks.fileId))
          .innerJoin(sources, eq(sources.id, chunks.sourceId))
          .where(eq(chunks.id, result.chunkId));
        expect(stored).toBeDefined();
        expect(result).toMatchObject({ ...stored, sourceId: repo.id });
        expect(result.locator.kind).toBe('lines');
      }
    });
  });

  describe('POST /search', () => {
    it('returns the fused results with their provenance', async () => {
      const repo = await newRepository();
      const target = await seedChunk(repo, {
        content: 'export function computeInvoiceTotal() {}',
        title: 'computeInvoiceTotal',
      });

      const response = await authorizedAgent(app)
        .post('/search')
        .send({ query: 'computeInvoiceTotal', sourceIds: [repo.id] })
        .expect(200);

      const body = response.body as SearchResponse;
      expect(body.results).toHaveLength(1);
      expect(body.results[0]).toMatchObject({
        chunkId: target.id,
        sourceId: repo.id,
        sourceName: repo.name,
        sourceKind: 'code_repository',
        title: 'computeInvoiceTotal',
        contentKind: 'code',
        locator: target.locator,
        sources: ['vector', 'lexical'],
        vectorRank: 1,
        lexicalRank: 1,
      });
    });

    it('searches the sources of a project', async () => {
      const repoA = await newRepository();
      const repoB = await newRepository();
      const target = await seedChunk(repoA, {
        content: 'export function computeInvoiceTotal() {}',
      });
      await seedChunk(repoB, {
        content: 'export function computeInvoiceTotal() {}',
      });
      const project = await projectFactory.create({}, create());
      await projectSourceFactory.create(
        { projectId: project.id, sourceId: repoA.id },
        create(),
      );

      const response = await authorizedAgent(app)
        .post('/search')
        .send({ query: 'computeInvoiceTotal', projectId: project.id })
        .expect(200);

      expect(
        (response.body as SearchResponse).results.map(
          (result) => result.chunkId,
        ),
      ).toEqual([target.id]);
    });

    it('returns 404 for an unknown project', async () => {
      await authorizedAgent(app)
        .post('/search')
        .send({ query: 'anything', projectId: faker.string.uuid() })
        .expect(404);
    });
  });
});
