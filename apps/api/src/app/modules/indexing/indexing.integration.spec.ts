import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type {
  CodebaseResponse,
  IndexJobResponse,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import type { AppConfig } from '@codebase-ai/server-config';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  indexJobFactory,
  prepareDedicatedDatabase,
  repositoryFactory,
} from '@codebase-ai/server-database/testing';
import {
  buildEmbeddingVectors,
  buildSampleRepository,
  createSandbox,
  type FixtureFiles,
  makeGitRepository,
  type Sandbox,
  testConfig,
  writeFiles,
} from '@codebase-ai/server-testing';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';
import { InferenceRequestRejectedError } from '../inference/errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../inference/errors/inference-unavailable.error';
import { EMBEDDING_PORT } from '../inference/types/embedding-port';
import { IndexJobRunnerService } from './services/index-job-runner.service';
import { IndexJobsService } from './services/index-jobs.service';

const { codeChunks, indexJobs, repositories, repositoryFiles } = schema;

const ALPHA_BETA = [
  'export function alpha(): number {',
  '  return 1;',
  '}',
  '',
  'export function beta(): number {',
  '  return 2;',
  '}',
  '',
].join('\n');

const baseFiles = (): FixtureFiles => ({
  'src/a.ts': ALPHA_BETA,
  'src/b.ts': 'export const b = 2;\n',
  'src/c.ts': 'export const c = 3;\n',
  '.env': `TOKEN=${CANARY_SECRET}\n`,
});

describeWithDatabase('indexing API', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let box: Sandbox;
  let config: AppConfig;
  const embedBatch = jest.fn<Promise<number[][]>, [readonly string[]]>();

  const api = () => authorizedAgent(app);
  const runner = () => app.get(IndexJobRunnerService, { strict: false });
  const embeddedTexts = (): string[] =>
    embedBatch.mock.calls.flatMap(([texts]) => [...texts]);
  const identity = () =>
    `${config.inference.runtime}/${config.inference.embeddingModel}`;

  const registerRepository = async (files: FixtureFiles) => {
    const path = makeGitRepository(
      box.root,
      `repo-${faker.string.alphanumeric(10).toLowerCase()}`,
    );
    writeFiles(path, files);
    const response = await api().post('/codebases').send({ path }).expect(201);
    return { id: (response.body as CodebaseResponse).id, path };
  };

  const startIndex = (id: string) => api().post(`/codebases/${id}/index`);

  const latest = async (id: string): Promise<LatestIndexJobResponse> =>
    (await api().get(`/codebases/${id}/index-jobs/latest`).expect(200))
      .body as LatestIndexJobResponse;

  const indexAndWait = async (id: string): Promise<LatestIndexJobResponse> => {
    await startIndex(id).expect(202);
    await runner().whenIdle();
    return latest(id);
  };

  const chunksOf = (repositoryId: string) =>
    handle.db
      .select()
      .from(codeChunks)
      .where(eq(codeChunks.repositoryId, repositoryId));

  const filesOf = (repositoryId: string) =>
    handle.db
      .select()
      .from(repositoryFiles)
      .where(eq(repositoryFiles.repositoryId, repositoryId));

  const statusOf = async (repositoryId: string) =>
    (
      await handle.db
        .select({ status: repositories.status })
        .from(repositories)
        .where(eq(repositories.id, repositoryId))
    )[0]?.status;

  beforeAll(async () => {
    box = createSandbox('caa-indexing-');
    const prepared = await prepareDedicatedDatabase(baseUrl, 'indexing');
    handle = prepared.handle;
    config = testConfig({
      DATABASE_URL: prepared.url,
      ALLOWED_REPO_ROOTS: box.root,
      INFERENCE_MAX_RETRIES: '0',
      INDEXING_EMBED_CONCURRENCY: '1',
    });
    app = await createTestApp({
      config,
      overrides: [{ provide: EMBEDDING_PORT, useValue: { embedBatch } }],
    });
  });

  beforeEach(() => {
    embedBatch.mockReset();
    embedBatch.mockImplementation(async (texts) =>
      buildEmbeddingVectors(texts.length, config.inference.embeddingDimensions),
    );
  });

  afterEach(async () => {
    await runner().whenIdle();
    await handle.db.delete(repositories);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
    box?.dispose();
  });

  describe('first index', () => {
    it('returns 202 with a queued job and indexes every included file', async () => {
      const repo = await registerRepository(baseFiles());
      const started = (await startIndex(repo.id).expect(202))
        .body as IndexJobResponse;
      expect(started).toMatchObject({
        codebaseId: repo.id,
        status: 'queued',
        filesDiscovered: 0,
      });
      await runner().whenIdle();

      const { job } = await latest(repo.id);
      const chunks = await chunksOf(repo.id);
      expect(job).toMatchObject({
        id: started.id,
        status: 'succeeded',
        filesIndexed: 3,
        filesSkipped: 1,
        filesFailed: 0,
        chunksWritten: chunks.length,
        errorSummary: null,
      });
      expect(job.filesDiscovered).toBe(4);
      expect(job.finishedAt).not.toBeNull();
      expect(embeddedTexts()).toHaveLength(chunks.length);
      expect(
        chunks.every(
          (chunk) =>
            chunk.embeddingModel === identity() &&
            chunk.embedding.length === config.inference.embeddingDimensions,
        ),
      ).toBe(true);
      expect(await statusOf(repo.id)).toBe('ready');
    });

    it('reports skip reasons without contents', async () => {
      const repo = await registerRepository(baseFiles());
      const { issues } = await indexAndWait(repo.id);
      expect(issues).toEqual([
        { relativePath: '.env', status: 'skipped', reason: 'secret-filename' },
      ]);
    });
  });

  describe('incremental updates', () => {
    it('re-indexes without duplicates or embedding calls', async () => {
      const repo = await registerRepository(baseFiles());
      await indexAndWait(repo.id);
      const before = await chunksOf(repo.id);
      embedBatch.mockClear();

      const { job } = await indexAndWait(repo.id);

      expect(embedBatch).not.toHaveBeenCalled();
      expect(job).toMatchObject({
        status: 'succeeded',
        filesDiscovered: 4,
        filesIndexed: 0,
        chunksWritten: 0,
      });
      const after = await chunksOf(repo.id);
      expect(after.map((chunk) => chunk.id).sort()).toEqual(
        before.map((chunk) => chunk.id).sort(),
      );
    });

    it('embeds only the changed chunks of a modified file', async () => {
      const repo = await registerRepository(baseFiles());
      await indexAndWait(repo.id);
      embedBatch.mockClear();

      writeFileSync(
        join(repo.path, 'src', 'a.ts'),
        ALPHA_BETA.replace('return 2;', 'return 22;'),
      );
      const { job } = await indexAndWait(repo.id);

      expect(job.filesIndexed).toBe(1);
      expect(embeddedTexts()).toEqual([expect.stringContaining('return 22;')]);
      const contents = (await chunksOf(repo.id)).map((chunk) => chunk.content);
      expect(contents.some((content) => content.includes('return 2;'))).toBe(
        false,
      );
    });

    it('removes the rows of a deleted file', async () => {
      const repo = await registerRepository(baseFiles());
      await indexAndWait(repo.id);

      rmSync(join(repo.path, 'src', 'b.ts'));
      await indexAndWait(repo.id);

      const paths = (await filesOf(repo.id)).map((file) => file.relativePath);
      expect(paths).not.toContain('src/b.ts');
      const contents = (await chunksOf(repo.id)).map((chunk) => chunk.content);
      expect(contents).not.toContain('export const b = 2;');
    });

    it('moves a renamed file and reuses its embeddings', async () => {
      const repo = await registerRepository(baseFiles());
      await indexAndWait(repo.id);
      embedBatch.mockClear();

      renameSync(
        join(repo.path, 'src', 'c.ts'),
        join(repo.path, 'src', 'renamed.ts'),
      );
      const { job } = await indexAndWait(repo.id);

      expect(embedBatch).not.toHaveBeenCalled();
      expect(job.filesIndexed).toBe(1);
      const paths = (await filesOf(repo.id)).map((file) => file.relativePath);
      expect(paths).toContain('src/renamed.ts');
      expect(paths).not.toContain('src/c.ts');
    });

    it.each([
      ['embedding identity', { embeddingModel: 'other-runtime/other-model' }],
      ['chunking version', { chunkingVersion: '0' }],
    ])('re-embeds everything when the %s changes', async (_, change) => {
      const repo = await registerRepository(baseFiles());
      await indexAndWait(repo.id);
      const chunkCount = (await chunksOf(repo.id)).length;
      await handle.db
        .update(repositoryFiles)
        .set(change)
        .where(eq(repositoryFiles.repositoryId, repo.id));
      await handle.db
        .update(codeChunks)
        .set(change)
        .where(eq(codeChunks.repositoryId, repo.id));
      embedBatch.mockClear();

      const { job } = await indexAndWait(repo.id);

      expect(job.filesIndexed).toBe(3);
      expect(embeddedTexts()).toHaveLength(chunkCount);
      const chunks = await chunksOf(repo.id);
      expect(chunks.every((chunk) => chunk.embeddingModel === identity())).toBe(
        true,
      );
    });
  });

  describe('failures', () => {
    it('fails the job with a sanitized summary and keeps finished files consistent', async () => {
      const repo = await registerRepository(baseFiles());
      let calls = 0;
      embedBatch.mockImplementation(async (texts) => {
        calls++;
        if (calls > 1) throw new InferenceUnavailableError('server-error');
        return buildEmbeddingVectors(
          texts.length,
          config.inference.embeddingDimensions,
        );
      });

      const { job } = await indexAndWait(repo.id);

      expect(job.status).toBe('failed');
      expect(job.errorSummary).toBe(
        new InferenceUnavailableError('server-error').message,
      );
      expect(await statusOf(repo.id)).toBe('failed');
      const files = await filesOf(repo.id);
      const chunks = await chunksOf(repo.id);
      for (const file of files.filter((row) => row.status === 'indexed')) {
        expect(chunks.some((chunk) => chunk.fileId === file.id)).toBe(true);
      }
      expect(
        chunks.every((chunk) =>
          files.some(
            (file) => file.id === chunk.fileId && file.status === 'indexed',
          ),
        ),
      ).toBe(true);
    });

    it('fails only the file whose input the runtime rejects', async () => {
      const repo = await registerRepository(baseFiles());
      embedBatch.mockImplementation(async (texts) => {
        if (texts.some((text) => text.includes('const b'))) {
          throw new InferenceRequestRejectedError(400);
        }
        return buildEmbeddingVectors(
          texts.length,
          config.inference.embeddingDimensions,
        );
      });

      const { job, issues } = await indexAndWait(repo.id);

      expect(job).toMatchObject({
        status: 'succeeded',
        filesIndexed: 2,
        filesFailed: 1,
      });
      expect(issues).toContainEqual({
        relativePath: 'src/b.ts',
        status: 'failed',
        reason: 'InferenceRequestRejectedError',
      });

      embedBatch.mockClear();
      embedBatch.mockImplementation(async (texts) =>
        buildEmbeddingVectors(
          texts.length,
          config.inference.embeddingDimensions,
        ),
      );
      const retried = await indexAndWait(repo.id);
      expect(retried.job.filesIndexed).toBe(1);
      expect(embeddedTexts()).toEqual(['export const b = 2;']);
    });
  });

  describe('job lifecycle', () => {
    const blockEmbeddings = () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      embedBatch.mockImplementation(async (texts) => {
        await gate;
        return buildEmbeddingVectors(
          texts.length,
          config.inference.embeddingDimensions,
        );
      });
      return () => release();
    };

    it('returns 409 while a job is active', async () => {
      const repo = await registerRepository(baseFiles());
      const release = blockEmbeddings();
      await startIndex(repo.id).expect(202);
      await startIndex(repo.id).expect(409);
      expect(await statusOf(repo.id)).toBe('indexing');
      release();
      await runner().whenIdle();
      expect((await latest(repo.id)).job.status).toBe('succeeded');
    });

    it('stops a running job when its codebase is deleted', async () => {
      const repo = await registerRepository(baseFiles());
      const release = blockEmbeddings();
      await startIndex(repo.id).expect(202);
      await api().delete(`/codebases/${repo.id}`).expect(204);
      release();
      await runner().whenIdle();

      expect(await chunksOf(repo.id)).toEqual([]);
      expect(await filesOf(repo.id)).toEqual([]);
      const jobs = await handle.db
        .select()
        .from(indexJobs)
        .where(eq(indexJobs.repositoryId, repo.id));
      expect(jobs).toEqual([]);
    });

    it('aborts a running job and records it as failed when the app shuts down', async () => {
      const repo = await registerRepository(baseFiles());
      let signal: AbortSignal | undefined;
      let embedStarted: () => void = () => undefined;
      const started = new Promise<void>((resolve) => (embedStarted = resolve));
      const hangingEmbedBatch = (
        _texts: readonly string[],
        options?: { signal?: AbortSignal },
      ) =>
        new Promise<number[][]>((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener('abort', () =>
            reject(new InferenceUnavailableError('network')),
          );
          embedStarted();
        });
      const shuttingDown = await createTestApp({
        config,
        overrides: [
          {
            provide: EMBEDDING_PORT,
            useValue: { embedBatch: hangingEmbedBatch },
          },
        ],
      });

      await authorizedAgent(shuttingDown)
        .post(`/codebases/${repo.id}/index`)
        .expect(202);
      await started;
      await shuttingDown.close();

      expect(signal?.aborted).toBe(true);
      const [job] = await handle.db
        .select()
        .from(indexJobs)
        .where(eq(indexJobs.repositoryId, repo.id));
      expect(job).toMatchObject({ status: 'failed' });
      expect(job.errorSummary).not.toMatch(/restart/);
      expect(await statusOf(repo.id)).toBe('failed');
    });

    it('marks jobs left active by a previous process as failed', async () => {
      const dbOptions = { transient: { db: handle.db } };
      const repository = await repositoryFactory.create(
        { status: 'indexing' },
        dbOptions,
      );
      const job = await indexJobFactory.create(
        { repositoryId: repository.id, status: 'running' },
        dbOptions,
      );

      await app.get(IndexJobsService, { strict: false }).failInterruptedJobs();

      const [row] = await handle.db
        .select()
        .from(indexJobs)
        .where(eq(indexJobs.id, job.id));
      expect(row).toMatchObject({ status: 'failed' });
      expect(row.errorSummary).toMatch(/restart/);
      expect(await statusOf(repository.id)).toBe('failed');
    });

    it('returns 404 for an unknown codebase or one never indexed', async () => {
      const unknown = faker.string.uuid();
      await startIndex(unknown).expect(404);
      await api().get(`/codebases/${unknown}/index-jobs/latest`).expect(404);
      const repo = await registerRepository(baseFiles());
      await api().get(`/codebases/${repo.id}/index-jobs/latest`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await startIndex('not-a-uuid').expect(400);
    });
  });

  describe('privacy', () => {
    it('never stores, returns or logs the canary secret', async () => {
      const messages: unknown[] = [];
      for (const method of ['log', 'warn', 'error', 'debug'] as const) {
        jest
          .spyOn(Logger.prototype, method)
          .mockImplementation((...args: unknown[]) => void messages.push(args));
      }
      const sample = buildSampleRepository(box);
      const registered = await api()
        .post('/codebases')
        .send({ path: sample.path })
        .expect(201);
      const id = (registered.body as CodebaseResponse).id;

      const { job } = await indexAndWait(id);
      const latestResponse = await api()
        .get(`/codebases/${id}/index-jobs/latest`)
        .expect(200);

      expect(job.status).toBe('succeeded');
      const leaked = await handle.db
        .select({ id: codeChunks.id })
        .from(codeChunks)
        .where(
          and(
            eq(codeChunks.repositoryId, id),
            sql`${codeChunks.content} like ${`%${CANARY_SECRET}%`}`,
          ),
        );
      expect(leaked).toEqual([]);
      assertNotLeaked(JSON.stringify(latestResponse.body), CANARY_SECRET);
      assertNotLeaked(JSON.stringify(embeddedTexts()), CANARY_SECRET);
      assertNotLeaked(JSON.stringify(messages), CANARY_SECRET, sample.path);
    }, 30_000);
  });
});
