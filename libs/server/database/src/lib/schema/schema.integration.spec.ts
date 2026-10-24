import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { loadConfig } from '@codebase-ai/server-config';
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

const envFile = join(__dirname, '..', '..', '..', '..', '..', '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env['TEST_DATABASE_URL'];
if (!url) {
  console.warn(
    'TEST_DATABASE_URL is not set; skipping database integration tests.',
  );
}
const describeDb = url ? describe : describe.skip;

// The suite drops the public schema, so refuse anything that is not clearly disposable.
function assertDisposable(connectionString: string): void {
  const name = new URL(connectionString).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL must point at a database whose name ends in _test',
    );
  }
}

const unitVector = (dimensions = EMBEDDING_DIMENSIONS) =>
  Array.from({ length: dimensions }, (_, i) => (i === 0 ? 1 : 0));

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

describeDb('database schema', () => {
  let handle: DatabaseHandle;

  const count = async (table: CountedTable) =>
    (await handle.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]
      .n;

  const chunkValues = (
    repositoryId: string,
    fileId: string,
    overrides: Partial<typeof codeChunks.$inferInsert> = {},
  ): typeof codeChunks.$inferInsert => ({
    repositoryId,
    fileId,
    chunkHash: 'chunk-hash',
    symbolName: 'parseConfig',
    startLine: 1,
    endLine: 3,
    content: 'export function parseConfig() {}',
    embedding: unitVector(),
    embeddingModel: 'test-model',
    chunkingVersion: '1',
    ...overrides,
  });

  async function seed() {
    const [repo] = await handle.db
      .insert(repositories)
      .values({ name: 'repo', canonicalPath: `/synthetic/${Math.random()}` })
      .returning();
    const [file] = await handle.db
      .insert(repositoryFiles)
      .values({
        repositoryId: repo.id,
        relativePath: 'src/a.ts',
        contentHash: 'file-hash',
        sizeBytes: 10,
        status: 'indexed',
      })
      .returning();
    await handle.db.insert(indexJobs).values({ repositoryId: repo.id });
    await handle.db.insert(codeChunks).values(chunkValues(repo.id, file.id));
    return { repo, file };
  }

  beforeAll(async () => {
    assertDisposable(url as string);
    handle = createDatabase(url as string);
    await handle.pool.query('drop schema if exists public cascade');
    await handle.pool.query('drop schema if exists drizzle cascade');
    await handle.pool.query('create schema public');
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
      await expect(service.checkHealth()).resolves.toEqual({
        status: 'up',
        vectorExtension: true,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
      });
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
    const { repo } = await seed();
    const error = await failure(
      handle.db.insert(repositoryFiles).values({
        repositoryId: repo.id,
        relativePath: 'src/a.ts',
        contentHash: 'other',
        sizeBytes: 1,
        status: 'indexed',
      }),
    );
    expect(error.code).toBe('23505');
  });

  it('allows the same relative path in different repositories', async () => {
    const first = await seed();
    const second = await seed();
    expect(first.file.relativePath).toBe(second.file.relativePath);
  });

  it('rejects a vector with the wrong dimension', async () => {
    const { repo, file } = await seed();
    const error = await failure(
      handle.db
        .insert(codeChunks)
        .values(chunkValues(repo.id, file.id, { embedding: unitVector(3) })),
    );
    expect(error.message).toMatch(/expected 768 dimensions, not 3/);
  });

  it('rejects a chunk whose file belongs to another repository', async () => {
    const a = await seed();
    const b = await seed();
    const error = await failure(
      handle.db.insert(codeChunks).values(chunkValues(b.repo.id, a.file.id)),
    );
    expect(error.code).toBe('23503');
  });

  it('rejects invalid line ranges', async () => {
    const { repo, file } = await seed();
    const error = await failure(
      handle.db
        .insert(codeChunks)
        .values(chunkValues(repo.id, file.id, { startLine: 5, endLine: 2 })),
    );
    expect(error.code).toBe('23514');
  });

  it('populates the full-text column from symbol name and content', async () => {
    await seed();
    const { rows } = await handle.pool.query(
      `select 1 from code_chunks where search_vector @@ to_tsquery('simple', 'parseconfig')`,
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
