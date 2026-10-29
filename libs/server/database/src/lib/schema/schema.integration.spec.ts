import { eq, sql } from 'drizzle-orm';
import { loadConfig } from '@codebase-ai/server-config';
import { databaseHealthFactory, faker } from '@codebase-ai/shared-testing';
import {
  assertDisposableDatabase,
  type CodeChunkInsert,
  codeChunkFactory,
  describeWithDatabase,
  indexJobFactory,
  type RepositoryFileInsert,
  repositoryFactory,
  repositoryFileFactory,
  resetSchema,
  unitVector,
} from '../../testing';
import {
  createDatabase,
  type DatabaseHandle,
} from '../connection/create-database';
import { runMigrations } from '../connection/migrate';
import { DatabaseService } from '../nest/database.service';
import {
  codeChunks,
  EMBEDDING_DIMENSIONS,
  indexJobs,
  repositories,
  repositoryFiles,
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
  | typeof repositoryFiles
  | typeof codeChunks
  | typeof indexJobs;

describeWithDatabase('database schema', (url) => {
  let handle: DatabaseHandle;

  const count = async (table: CountedTable) =>
    (await handle.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]
      .n;

  const create = () => ({ transient: { db: handle.db } });

  async function seed(
    file: Partial<RepositoryFileInsert> = {},
    chunk: Partial<CodeChunkInsert> = {},
  ) {
    const repo = await repositoryFactory.create({}, create());
    const savedFile = await repositoryFileFactory.create(
      { repositoryId: repo.id, ...file },
      create(),
    );
    await indexJobFactory.create({ repositoryId: repo.id }, create());
    const savedChunk = await codeChunkFactory.create(
      { repositoryId: repo.id, fileId: savedFile.id, ...chunk },
      create(),
    );
    return { repo, file: savedFile, chunk: savedChunk };
  }

  beforeAll(async () => {
    assertDisposableDatabase(url);
    handle = createDatabase(url);
    await resetSchema(handle);
  });

  afterEach(async () => {
    await handle.db.delete(repositories);
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
      'code_chunks',
      'index_jobs',
      'repositories',
      'repository_files',
    ]);
  });

  it('creates the vector, full-text, and hash indexes', async () => {
    const { rows } = await handle.pool.query(
      `select indexdef from pg_indexes where tablename = 'code_chunks'`,
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

  it('cascades repository deletion to files, chunks, and jobs', async () => {
    const { repo } = await seed();
    expect(await count(codeChunks)).toBe(1);
    await handle.db.delete(repositories).where(eq(repositories.id, repo.id));
    expect(await count(repositoryFiles)).toBe(0);
    expect(await count(codeChunks)).toBe(0);
    expect(await count(indexJobs)).toBe(0);
  });

  it('cascades file deletion to its chunks', async () => {
    const { file } = await seed();
    await handle.db
      .delete(repositoryFiles)
      .where(eq(repositoryFiles.id, file.id));
    expect(await count(codeChunks)).toBe(0);
  });

  it('enforces unique relative paths per repository', async () => {
    const { repo, file } = await seed();
    const error = await failure(
      repositoryFileFactory.create(
        { repositoryId: repo.id, relativePath: file.relativePath },
        create(),
      ),
    );
    expect(error.code).toBe('23505');
  });

  it('allows the same relative path in different repositories', async () => {
    const relativePath = `src/${faker.word.noun()}.ts`;
    const first = await seed({ relativePath });
    const second = await seed({ relativePath });
    expect(first.file.relativePath).toBe(second.file.relativePath);
  });

  it('allows a skipped file without a content hash', async () => {
    const repo = await repositoryFactory.create({}, create());
    const file = await repositoryFileFactory.create(
      {
        repositoryId: repo.id,
        status: 'skipped',
        contentHash: null,
        sizeBytes: null,
      },
      create(),
    );
    expect(file.contentHash).toBeNull();
  });

  it('requires a content hash for indexed and failed files', async () => {
    const repo = await repositoryFactory.create({}, create());
    const error = await failure(
      repositoryFileFactory.create(
        { repositoryId: repo.id, contentHash: null },
        create(),
      ),
    );
    expect(error.code).toBe('23514');
  });

  it('allows only one active index job per repository', async () => {
    const repo = await repositoryFactory.create({}, create());
    await indexJobFactory.create(
      { repositoryId: repo.id, status: 'succeeded' },
      create(),
    );
    await indexJobFactory.create(
      { repositoryId: repo.id, status: 'running' },
      create(),
    );
    const error = await failure(
      indexJobFactory.create({ repositoryId: repo.id }, create()),
    );
    expect(error.code).toBe('23505');
  });

  it('rejects a vector with the wrong dimension', async () => {
    const { repo, file } = await seed();
    const error = await failure(
      codeChunkFactory.create(
        {
          repositoryId: repo.id,
          fileId: file.id,
          embedding: unitVector(3),
        },
        create(),
      ),
    );
    expect(error.message).toMatch(/expected 768 dimensions, not 3/);
  });

  it('rejects a chunk whose file belongs to another repository', async () => {
    const a = await seed();
    const b = await seed();
    const error = await failure(
      codeChunkFactory.create(
        { repositoryId: b.repo.id, fileId: a.file.id },
        create(),
      ),
    );
    expect(error.code).toBe('23503');
  });

  it('rejects invalid line ranges', async () => {
    const { repo, file } = await seed();
    const startLine = faker.number.int({ min: 2, max: 100 });
    const error = await failure(
      codeChunkFactory.create(
        {
          repositoryId: repo.id,
          fileId: file.id,
          startLine,
          endLine: startLine - 1,
        },
        create(),
      ),
    );
    expect(error.code).toBe('23514');
  });

  it('populates the full-text column from symbol name and content', async () => {
    const { chunk } = await seed();
    const { rows } = await handle.pool.query(
      `select 1 from code_chunks where search_vector @@ to_tsquery('simple', $1)`,
      [chunk.symbolName?.toLowerCase()],
    );
    expect(rows).toHaveLength(1);
  });

  it('supports nearest-neighbour search by cosine distance', async () => {
    await seed();
    const { rows } = await handle.pool.query(
      `select 1 from code_chunks order by embedding <=> $1::vector limit 1`,
      [JSON.stringify(unitVector())],
    );
    expect(rows).toHaveLength(1);
  });
});
