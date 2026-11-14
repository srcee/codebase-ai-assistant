import { eq, sql } from 'drizzle-orm';
import { loadConfig } from '@codebase-ai/server-config';
import { databaseHealthFactory, faker } from '@codebase-ai/shared-testing';
import {
  assertDisposableDatabase,
  type ChunkInsert,
  chunkFactory,
  describeWithDatabase,
  indexJobFactory,
  projectFactory,
  projectSourceFactory,
  resetSchema,
  type SourceFileInsert,
  sourceFactory,
  sourceFileFactory,
  unitVector,
} from '../../testing';
import {
  createDatabase,
  type DatabaseHandle,
} from '../connection/create-database';
import { runMigrations } from '../connection/migrate';
import { DatabaseService } from '../nest/database.service';
import {
  chunks,
  EMBEDDING_DIMENSIONS,
  indexJobs,
  projectSources,
  projects,
  sourceFiles,
  sources,
} from '.';

/** Drizzle wraps driver errors; the Postgres details live on `cause`. */
async function failure(
  statement: PromiseLike<unknown>,
): Promise<{ code?: string; message: string }> {
  try {
    await statement;
  } catch (error) {
    const e = error as { cause?: { code?: string; message: string } };
    return e.cause ?? (error as { message: string });
  }
  throw new Error('expected the statement to fail');
}

type CountedTable =
  | typeof sources
  | typeof sourceFiles
  | typeof chunks
  | typeof indexJobs
  | typeof projectSources;

describeWithDatabase('database schema', (url) => {
  let handle: DatabaseHandle;

  const count = async (table: CountedTable) =>
    (await handle.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]
      .n;

  const create = () => ({ transient: { db: handle.db } });

  async function seed(
    file: Partial<SourceFileInsert> = {},
    chunk: Partial<ChunkInsert> = {},
  ) {
    const source = await sourceFactory.create({}, create());
    const savedFile = await sourceFileFactory.create(
      { sourceId: source.id, ...file },
      create(),
    );
    await indexJobFactory.create({ sourceId: source.id }, create());
    const savedChunk = await chunkFactory.create(
      { sourceId: source.id, fileId: savedFile.id, ...chunk },
      create(),
    );
    return { source, file: savedFile, chunk: savedChunk };
  }

  beforeAll(async () => {
    assertDisposableDatabase(url);
    handle = createDatabase(url);
    await resetSchema(handle);
  });

  afterEach(async () => {
    await handle.db.delete(projects);
    await handle.db.delete(sources);
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  it('applies migrations on an empty database and is repeatable', async () => {
    await runMigrations(handle.db);
    await expect(runMigrations(handle.db)).resolves.toBeUndefined();
    const { rows } = await handle.pool.query(
      `select tablename from pg_tables where schemaname = 'public' order by 1`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      'chunks',
      'index_jobs',
      'project_sources',
      'projects',
      'source_files',
      'sources',
    ]);
  });

  it('creates the vector, full-text, and hash indexes', async () => {
    const { rows } = await handle.pool.query(
      `select indexdef from pg_indexes where tablename = 'chunks'`,
    );
    const defs = rows.map((r) => r.indexdef as string).join('\n');
    expect(defs).toMatch(/USING hnsw .*vector_cosine_ops/);
    expect(defs).toMatch(/USING gin \(search_vector\)/);
    expect(defs).toMatch(/\(chunk_hash\)/);
  });

  it('reports a healthy database through the service', async () => {
    const service = new DatabaseService(loadConfig({ DATABASE_URL: url }));
    try {
      await expect(service.checkHealth()).resolves.toEqual(
        databaseHealthFactory.build({
          embeddingDimensions: EMBEDDING_DIMENSIONS,
        }),
      );
    } finally {
      await service.onApplicationShutdown();
    }
  });

  it('cascades source deletion to files, chunks, and jobs', async () => {
    const { source } = await seed();
    expect(await count(chunks)).toBe(1);
    await handle.db.delete(sources).where(eq(sources.id, source.id));
    expect(await count(sourceFiles)).toBe(0);
    expect(await count(chunks)).toBe(0);
    expect(await count(indexJobs)).toBe(0);
  });

  it('cascades file deletion to its chunks', async () => {
    const { file } = await seed();
    await handle.db.delete(sourceFiles).where(eq(sourceFiles.id, file.id));
    expect(await count(chunks)).toBe(0);
  });

  it('enforces unique relative paths per source', async () => {
    const { source, file } = await seed();
    const error = await failure(
      sourceFileFactory.create(
        { sourceId: source.id, relativePath: file.relativePath },
        create(),
      ),
    );
    expect(error.code).toBe('23505');
  });

  it('allows the same relative path in different sources', async () => {
    const relativePath = `src/${faker.word.noun()}.ts`;
    const first = await seed({ relativePath });
    const second = await seed({ relativePath });
    expect(first.file.relativePath).toBe(second.file.relativePath);
  });

  it('allows a skipped file without a content hash', async () => {
    const source = await sourceFactory.create({}, create());
    const file = await sourceFileFactory.create(
      {
        sourceId: source.id,
        status: 'skipped',
        contentHash: null,
        sizeBytes: null,
      },
      create(),
    );
    expect(file.contentHash).toBeNull();
  });

  it('requires a content hash for indexed and failed files', async () => {
    const source = await sourceFactory.create({}, create());
    const error = await failure(
      sourceFileFactory.create(
        { sourceId: source.id, contentHash: null },
        create(),
      ),
    );
    expect(error.code).toBe('23514');
  });

  it('allows only one active index job per source', async () => {
    const source = await sourceFactory.create({}, create());
    await indexJobFactory.create(
      { sourceId: source.id, status: 'succeeded' },
      create(),
    );
    await indexJobFactory.create(
      { sourceId: source.id, status: 'running' },
      create(),
    );
    const error = await failure(
      indexJobFactory.create({ sourceId: source.id }, create()),
    );
    expect(error.code).toBe('23505');
  });

  it('rejects a vector with the wrong dimension', async () => {
    const { source, file } = await seed();
    const error = await failure(
      chunkFactory.create(
        {
          sourceId: source.id,
          fileId: file.id,
          embedding: unitVector(3),
        },
        create(),
      ),
    );
    expect(error.message).toMatch(/expected 768 dimensions, not 3/);
  });

  it('rejects a chunk whose file belongs to another source', async () => {
    const a = await seed();
    const b = await seed();
    const error = await failure(
      chunkFactory.create(
        { sourceId: b.source.id, fileId: a.file.id },
        create(),
      ),
    );
    expect(error.code).toBe('23503');
  });

  it('rejects invalid line ranges', async () => {
    const { source, file } = await seed();
    const startLine = faker.number.int({ min: 2, max: 100 });
    const error = await failure(
      chunkFactory.create(
        {
          sourceId: source.id,
          fileId: file.id,
          startLine,
          endLine: startLine - 1,
        },
        create(),
      ),
    );
    expect(error.code).toBe('23514');
  });

  it('allows a chunk without lines', async () => {
    const { source, file } = await seed();
    const page = faker.number.int({ min: 1, max: 50 });
    const chunk = await chunkFactory.create(
      {
        sourceId: source.id,
        fileId: file.id,
        contentKind: 'prose',
        locator: { kind: 'page', page },
        startLine: null,
        endLine: null,
      },
      create(),
    );
    expect(chunk.locator).toEqual({ kind: 'page', page });
  });

  it('rejects a chunk with only one line bound', async () => {
    const { source, file } = await seed();
    const error = await failure(
      chunkFactory.create(
        { sourceId: source.id, fileId: file.id, endLine: null },
        create(),
      ),
    );
    expect(error.code).toBe('23514');
  });

  it.each([
    ['an unknown locator kind', { locator: { kind: 'paragraph' } }],
    ['a locator without a kind', { locator: {} }],
    ['an unknown content kind', { contentKind: 'video' }],
  ])('rejects %s', async (_label, values) => {
    const { source, file } = await seed();
    const error = await failure(
      chunkFactory.create(
        {
          sourceId: source.id,
          fileId: file.id,
          ...(values as unknown as Partial<ChunkInsert>),
        },
        create(),
      ),
    );
    expect(error.code).toBe('23514');
  });

  it.each([
    ['an unknown kind', { kind: 'wiki' }],
    ['an unknown origin', { origin: 'remote' }],
    [
      'a document collection without an origin',
      { kind: 'document_collection', origin: null },
    ],
  ])('rejects a source with %s', async (_label, values) => {
    const error = await failure(sourceFactory.create(values, create()));
    expect(error.code).toBe('23514');
  });

  it('accepts a document collection with an origin', async () => {
    const source = await sourceFactory.create(
      { kind: 'document_collection', origin: 'upload' },
      create(),
    );
    expect(source.kind).toBe('document_collection');
  });

  it('rejects the same source twice in one project', async () => {
    const project = await projectFactory.create({}, create());
    const source = await sourceFactory.create({}, create());
    const link = { projectId: project.id, sourceId: source.id };
    await projectSourceFactory.create(link, create());
    const error = await failure(projectSourceFactory.create(link, create()));
    expect(error.code).toBe('23505');
  });

  it('keeps sources and chunks when a project is deleted', async () => {
    const { source } = await seed();
    const project = await projectFactory.create({}, create());
    await projectSourceFactory.create(
      { projectId: project.id, sourceId: source.id },
      create(),
    );
    await handle.db.delete(projects).where(eq(projects.id, project.id));
    expect(await count(projectSources)).toBe(0);
    expect(await count(sources)).toBe(1);
    expect(await count(chunks)).toBe(1);
  });

  it('removes a deleted source from its projects', async () => {
    const { source } = await seed();
    const project = await projectFactory.create({}, create());
    await projectSourceFactory.create(
      { projectId: project.id, sourceId: source.id },
      create(),
    );
    await handle.db.delete(sources).where(eq(sources.id, source.id));
    expect(await count(projectSources)).toBe(0);
    const [kept] = await handle.db
      .select()
      .from(projects)
      .where(eq(projects.id, project.id));
    expect(kept).toEqual(project);
  });

  it('moves a project updated_at forward on every update', async () => {
    const project = await projectFactory.create(
      { updatedAt: faker.date.past() },
      create(),
    );
    const [updated] = await handle.db
      .update(projects)
      .set({ name: faker.word.noun() })
      .where(eq(projects.id, project.id))
      .returning();
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      project.updatedAt.getTime(),
    );
  });

  it('populates the full-text column from title and content', async () => {
    const { chunk } = await seed();
    const { rows } = await handle.pool.query(
      `select 1 from chunks where search_vector @@ to_tsquery('simple', $1)`,
      [chunk.title?.toLowerCase()],
    );
    expect(rows).toHaveLength(1);
  });

  it('makes the search terms and title searchable with different weights', async () => {
    const term = faker.string.alpha({ length: 12, casing: 'lower' });
    const { chunk } = await seed(
      {},
      { title: 'fixedsymbol', content: 'const x = 1;', searchTerms: term },
    );
    const { rows } = await handle.pool.query(
      `select
         search_vector @@ to_tsquery('simple', $1) as by_term,
         ts_rank(search_vector, to_tsquery('simple', $1)) < ts_rank(search_vector, to_tsquery('simple', 'fixedsymbol')) as title_outranks_term
       from chunks where id = $2`,
      [term, chunk.id],
    );
    expect(rows[0]).toEqual({ by_term: true, title_outranks_term: true });
  });

  it('supports nearest-neighbour search by cosine distance', async () => {
    await seed();
    const { rows } = await handle.pool.query(
      `select 1 from chunks order by embedding <=> $1::vector limit 1`,
      [JSON.stringify(unitVector())],
    );
    expect(rows).toHaveLength(1);
  });
});
