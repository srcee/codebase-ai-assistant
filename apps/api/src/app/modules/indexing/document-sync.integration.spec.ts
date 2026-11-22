import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type {
  ChatDoneEvent,
  CodebaseResponse,
  DocumentChangesResponse,
  DocumentCollectionResponse,
  IndexedFileIssue,
  IndexJobResponse,
  LatestIndexJobResponse,
  ProjectResponse,
  ProjectSyncResponse,
  SearchResponse,
} from '@codebase-ai/contracts';
import type { AppConfig } from '@codebase-ai/server-config';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  prepareDedicatedDatabase,
  unitVector,
} from '@codebase-ai/server-database/testing';
import {
  buildSampleDocuments,
  createSandbox,
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
import {
  bufferEventStream,
  parseEventStream,
} from '../../../testing/event-stream';
import {
  fixtureParseWorkerEntry,
  PARSE_WORKER_MARKERS,
} from '../../../testing/parse-worker-fixtures';
import { DocumentParsingService } from '../document-ingestion/services/document-parsing.service';
import { PARSE_WORKER_ENTRY } from '../document-ingestion/types/parse-worker-entry';
import type { ChatMessage } from '../inference/types/chat-message';
import { CHAT_PORT } from '../inference/types/chat-port';
import { EMBEDDING_PORT } from '../inference/types/embedding-port';
import { IndexJobRunnerService } from './services/index-job-runner.service';

const { chunks: chunkTable, sources, sourceFiles } = schema;

// Postgres orders paths by its collation, so specs compare issues in code-point order.
const byPath = (issues: readonly IndexedFileIssue[]): IndexedFileIssue[] =>
  [...issues].sort((a, b) =>
    a.relativePath < b.relativePath
      ? -1
      : a.relativePath > b.relativePath
        ? 1
        : 0,
  );

// Parse workers load TypeScript through ts-node in specs, which takes a moment per worker.
jest.setTimeout(60_000);

describeWithDatabase('document sync', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let box: Sandbox;
  let config: AppConfig;
  let answer: string;
  const prompts: ChatMessage[][] = [];
  const embedBatch = jest.fn<Promise<number[][]>, [readonly string[]]>();

  const api = () => authorizedAgent(app);
  const runner = () => app.get(IndexJobRunnerService, { strict: false });
  const embeddedTexts = (): string[] =>
    embedBatch.mock.calls.flatMap(([texts]) => [...texts]);
  const uniqueName = (prefix: string) =>
    `${prefix}-${faker.string.alphanumeric(10).toLowerCase()}`;

  const registerFolder = async (path: string): Promise<string> => {
    const response = await api()
      .post('/document-collections')
      .send({ name: 'Docs', origin: 'folder', path })
      .expect(201);
    return (response.body as DocumentCollectionResponse).id;
  };

  const registerSample = async () => {
    const path = buildSampleDocuments(box, uniqueName('docs'));
    return { id: await registerFolder(path), path };
  };

  const latest = async (id: string): Promise<LatestIndexJobResponse> =>
    (
      await api()
        .get(`/document-collections/${id}/index-jobs/latest`)
        .expect(200)
    ).body as LatestIndexJobResponse;

  const syncAndWait = async (
    id: string,
    target: INestApplication = app,
  ): Promise<LatestIndexJobResponse> => {
    await authorizedAgent(target)
      .post(`/document-collections/${id}/sync`)
      .expect(202);
    await target.get(IndexJobRunnerService, { strict: false }).whenIdle();
    return (
      await authorizedAgent(target)
        .get(`/document-collections/${id}/index-jobs/latest`)
        .expect(200)
    ).body as LatestIndexJobResponse;
  };

  const changesOf = async (id: string): Promise<DocumentChangesResponse> =>
    (await api().get(`/document-collections/${id}/changes`).expect(200))
      .body as DocumentChangesResponse;

  const chunksOf = (sourceId: string) =>
    handle.db
      .select()
      .from(chunkTable)
      .where(eq(chunkTable.sourceId, sourceId));

  const filesOf = (sourceId: string) =>
    handle.db
      .select()
      .from(sourceFiles)
      .where(eq(sourceFiles.sourceId, sourceId));

  const blockEmbeddings = () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    embedBatch.mockImplementation(async (texts) => {
      await gate;
      return texts.map(() => unitVector());
    });
    return () => release();
  };

  beforeAll(async () => {
    box = createSandbox('caa-document-sync-');
    const prepared = await prepareDedicatedDatabase(baseUrl, 'document_sync');
    handle = prepared.handle;
    config = testConfig({
      DATABASE_URL: prepared.url,
      ALLOWED_DOCUMENT_ROOTS: box.root,
      ALLOWED_REPO_ROOTS: box.root,
      INFERENCE_MAX_RETRIES: '0',
      INDEXING_EMBED_CONCURRENCY: '1',
      RETRIEVAL_DEBUG_ENDPOINT: 'true',
      PARSE_WORKERS: '1',
      // Every document goes through the real parse worker.
      PARSE_INLINE_MAX_BYTES: '0',
    });
    app = await createTestApp({
      config,
      overrides: [
        { provide: EMBEDDING_PORT, useValue: { embedBatch } },
        {
          provide: CHAT_PORT,
          useValue: {
            complete: async () => '',
            stream: async function* (sent: readonly ChatMessage[]) {
              prompts.push([...sent]);
              yield answer;
            },
          },
        },
      ],
    });
  });

  beforeEach(() => {
    prompts.length = 0;
    answer = 'No answer.';
    embedBatch.mockReset();
    embedBatch.mockImplementation(async (texts) =>
      texts.map(() => unitVector()),
    );
  });

  afterEach(async () => {
    await runner().whenIdle();
    await handle.db.delete(schema.conversations);
    await handle.db.delete(schema.projects);
    await handle.db.delete(sources);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
    box?.dispose();
  });

  describe('first sync', () => {
    it('indexes Markdown by section and table rows, and text by lines', async () => {
      const { id } = await registerSample();
      const started = (
        await api().post(`/document-collections/${id}/sync`).expect(202)
      ).body as IndexJobResponse;
      expect(started).toMatchObject({ sourceId: id, status: 'queued' });
      await runner().whenIdle();

      const { job, issues } = await latest(id);
      expect(job).toMatchObject({
        id: started.id,
        status: 'succeeded',
        filesDiscovered: 9,
        filesIndexed: 3,
        filesSkipped: 6,
        filesFailed: 0,
      });
      expect(byPath(issues)).toEqual([
        { relativePath: '.env', status: 'skipped', reason: 'secret-filename' },
        {
          relativePath: '.gitignore',
          status: 'skipped',
          reason: 'unsupported-extension',
        },
        {
          relativePath: 'design/mockup.png',
          status: 'skipped',
          reason: 'excluded-path',
        },
        {
          relativePath: 'notes/binary.txt',
          status: 'skipped',
          reason: 'binary',
        },
        {
          relativePath: 'notes/leaked.md',
          status: 'skipped',
          reason: 'secret-content',
        },
        {
          relativePath: 'specs/matrix.xlsx',
          status: 'skipped',
          reason: 'unsupported-extension',
        },
      ]);

      const chunks = await chunksOf(id);
      expect(
        chunks
          .map((chunk) => [chunk.title, chunk.contentKind, chunk.locator.kind])
          .sort(),
      ).toEqual(
        [
          [null, 'prose', 'lines'],
          ['Roles', 'prose', 'section'],
          ['Roles > Reviewer', 'prose', 'section'],
          ['Roles > Reviewer > Permissions', 'table_rows', 'table_rows'],
          ['Workflows > Approval', 'prose', 'section'],
        ].sort(),
      );
      const files = await filesOf(id);
      expect(
        files
          .filter((file) => file.status === 'indexed')
          .map((file) => [
            file.relativePath,
            file.language,
            file.chunkingVersion,
          ])
          .sort(),
      ).toEqual([
        ['notes/glossary.txt', 'text', 'text-1'],
        ['specs/roles.md', 'markdown', 'markdown-1'],
        ['specs/workflows.md', 'markdown', 'markdown-1'],
      ]);
      expect(embeddedTexts()).toHaveLength(chunks.length);
      const collection = (
        await api().get(`/document-collections/${id}`).expect(200)
      ).body as DocumentCollectionResponse;
      expect(collection.status).toBe('ready');
    });

    it('never stores, returns, embeds, or logs the canary secret', async () => {
      const messages: unknown[] = [];
      for (const method of ['log', 'warn', 'error', 'debug'] as const) {
        jest
          .spyOn(Logger.prototype, method)
          .mockImplementation((...args: unknown[]) => void messages.push(args));
      }
      const { id, path } = await registerSample();
      const latestJob = await syncAndWait(id);

      const leaked = await handle.db
        .select({ id: chunkTable.id })
        .from(chunkTable)
        .where(
          and(
            eq(chunkTable.sourceId, id),
            sql`${chunkTable.content} like ${`%${CANARY_SECRET}%`}`,
          ),
        );
      expect(leaked).toEqual([]);
      assertNotLeaked(JSON.stringify(latestJob), CANARY_SECRET);
      assertNotLeaked(JSON.stringify(embeddedTexts()), CANARY_SECRET);
      assertNotLeaked(JSON.stringify(messages), CANARY_SECRET, path);
    });
  });

  describe('incremental sync', () => {
    it('neither parses nor embeds unchanged files, including files skipped for their content', async () => {
      const { id } = await registerSample();
      await syncAndWait(id);
      const before = await chunksOf(id);
      embedBatch.mockClear();
      const parse = jest.spyOn(
        app.get(DocumentParsingService, { strict: false }),
        'parse',
      );

      const { job } = await syncAndWait(id);

      expect(parse).not.toHaveBeenCalled();
      expect(embedBatch).not.toHaveBeenCalled();
      expect(job).toMatchObject({
        status: 'succeeded',
        filesDiscovered: 9,
        filesIndexed: 0,
        chunksWritten: 0,
      });
      expect((await chunksOf(id)).map((chunk) => chunk.id).sort()).toEqual(
        before.map((chunk) => chunk.id).sort(),
      );
    });

    it('re-embeds a changed file, drops a removed one, and reuses vectors for a renamed one', async () => {
      const { id, path } = await registerSample();
      await syncAndWait(id);
      embedBatch.mockClear();

      writeFileSync(
        join(path, 'specs', 'workflows.md'),
        '# Workflows\n\n## Approval\n\nA change request needs two approvals before release.\n',
      );
      rmSync(join(path, 'notes', 'glossary.txt'));
      renameSync(
        join(path, 'specs', 'roles.md'),
        join(path, 'specs', 'access.md'),
      );
      const { job } = await syncAndWait(id);

      expect(job.filesIndexed).toBe(2);
      expect(embeddedTexts()).toEqual([
        expect.stringContaining('two approvals'),
      ]);
      const paths = (await filesOf(id)).map((file) => file.relativePath);
      expect(paths).toContain('specs/access.md');
      expect(paths).not.toContain('specs/roles.md');
      expect(paths).not.toContain('notes/glossary.txt');
    });

    it('reports new, changed, and removed files without parsing or embedding', async () => {
      const { id, path } = await registerSample();
      expect(await changesOf(id)).toEqual({ new: 5, changed: 0, removed: 0 });
      await syncAndWait(id);
      expect(await changesOf(id)).toEqual({ new: 0, changed: 0, removed: 0 });

      embedBatch.mockClear();
      const parse = jest.spyOn(
        app.get(DocumentParsingService, { strict: false }),
        'parse',
      );
      writeFileSync(join(path, 'specs', 'roles.md'), '# Roles\n\nChanged.\n');
      writeFileSync(join(path, 'notes', 'new.md'), '# New\n\nAdded.\n');
      rmSync(join(path, 'specs', 'workflows.md'));

      expect(await changesOf(id)).toEqual({ new: 1, changed: 1, removed: 1 });
      expect(parse).not.toHaveBeenCalled();
      expect(embedBatch).not.toHaveBeenCalled();
    });
  });

  describe('parse failures', () => {
    let failing: INestApplication;

    beforeAll(async () => {
      failing = await createTestApp({
        config: testConfig({
          DATABASE_URL: config.databaseUrl as string,
          ALLOWED_DOCUMENT_ROOTS: box.root,
          INDEXING_EMBED_CONCURRENCY: '1',
          PARSE_WORKERS: '1',
          PARSE_INLINE_MAX_BYTES: '0',
          PARSE_TIMEOUT_MS: '1000',
        }),
        overrides: [
          { provide: EMBEDDING_PORT, useValue: { embedBatch } },
          { provide: PARSE_WORKER_ENTRY, useValue: fixtureParseWorkerEntry() },
        ],
      });
    });

    afterAll(() => failing?.close());

    it('fails only the files whose parse hangs or crashes and finishes the job', async () => {
      const path = join(box.root, uniqueName('failing'));
      writeFiles(path, {
        'good.md': '# Good\n\nIndexed.\n',
        'hang.md': `# Hang\n\n${PARSE_WORKER_MARKERS.hang}\n`,
        'exit.md': `# Exit\n\n${PARSE_WORKER_MARKERS.exit}\n`,
      });
      const id = await registerFolder(path);

      const { job, issues } = await syncAndWait(id, failing);

      expect(job).toMatchObject({
        status: 'succeeded',
        filesIndexed: 1,
        filesFailed: 2,
      });
      expect(byPath(issues)).toEqual([
        { relativePath: 'exit.md', status: 'failed', reason: 'parse_crashed' },
        { relativePath: 'hang.md', status: 'failed', reason: 'parse_timeout' },
      ]);
    });
  });

  describe('job lifecycle', () => {
    it('returns 409 while a sync is active', async () => {
      const { id } = await registerSample();
      const release = blockEmbeddings();
      await api().post(`/document-collections/${id}/sync`).expect(202);
      const conflict = await api()
        .post(`/document-collections/${id}/sync`)
        .expect(409);
      expect(conflict.body.message).toContain('document collection');
      release();
      await runner().whenIdle();
      expect((await latest(id)).job.status).toBe('succeeded');
    });

    it('stops a running sync when its collection is deleted', async () => {
      const { id } = await registerSample();
      const release = blockEmbeddings();
      await api().post(`/document-collections/${id}/sync`).expect(202);
      await api().delete(`/document-collections/${id}`).expect(204);
      release();
      await runner().whenIdle();

      expect(await chunksOf(id)).toEqual([]);
      expect(await filesOf(id)).toEqual([]);
    });

    it('returns 404 for an unknown collection, a codebase, or a collection never synced', async () => {
      const unknown = faker.string.uuid();
      await api().post(`/document-collections/${unknown}/sync`).expect(404);
      await api().get(`/document-collections/${unknown}/changes`).expect(404);

      const repository = makeGitRepository(box.root, uniqueName('repo'));
      const codebase = (
        await api().post('/codebases').send({ path: repository }).expect(201)
      ).body as CodebaseResponse;
      await api().post(`/document-collections/${codebase.id}/sync`).expect(404);
      await api()
        .get(`/document-collections/${codebase.id}/changes`)
        .expect(404);

      const { id } = await registerSample();
      await api()
        .get(`/document-collections/${id}/index-jobs/latest`)
        .expect(404);
      await api().post(`/codebases/${id}/index`).expect(404);
    });
  });

  describe('project sync', () => {
    const createProject = async (sourceIds: string[]): Promise<string> => {
      const project = (
        await api().post('/projects').send({ name: 'Product' }).expect(201)
      ).body as ProjectResponse;
      await api()
        .put(`/projects/${project.id}/sources`)
        .send({ sourceIds })
        .expect(200);
      return project.id;
    };

    it('starts one job per source and reports sources that are already syncing', async () => {
      const repository = makeGitRepository(box.root, uniqueName('repo'));
      writeFiles(repository, { 'src/a.ts': 'export const a = 1;\n' });
      const codebase = (
        await api().post('/codebases').send({ path: repository }).expect(201)
      ).body as CodebaseResponse;
      const { id: collectionId } = await registerSample();
      const projectId = await createProject([codebase.id, collectionId]);

      const release = blockEmbeddings();
      const first = (
        await api().post(`/projects/${projectId}/sync`).expect(202)
      ).body as ProjectSyncResponse;
      const second = (
        await api().post(`/projects/${projectId}/sync`).expect(202)
      ).body as ProjectSyncResponse;
      release();
      await runner().whenIdle();

      expect(first.started.map((job) => job.sourceId).sort()).toEqual(
        [codebase.id, collectionId].sort(),
      );
      expect(first.alreadyActive).toEqual([]);
      expect(second.started).toEqual([]);
      expect(second.alreadyActive.map((job) => job.id).sort()).toEqual(
        first.started.map((job) => job.id).sort(),
      );
    });

    it('returns 404 for an unknown project', async () => {
      await api().post(`/projects/${faker.string.uuid()}/sync`).expect(404);
    });
  });

  describe('scope', () => {
    it('searches and cites a collection only within the selected project', async () => {
      const member = await registerSample();
      const outsiderPath = join(box.root, uniqueName('outsider'));
      writeFiles(outsiderPath, {
        'roles.md':
          '# Roles\n\n## Reviewer\n\nA reviewer may also delete projects (outsider).\n',
      });
      const outsiderId = await registerFolder(outsiderPath);
      await syncAndWait(member.id);
      await syncAndWait(outsiderId);
      const project = (
        await api().post('/projects').send({ name: 'Docs' }).expect(201)
      ).body as ProjectResponse;
      await api()
        .put(`/projects/${project.id}/sources`)
        .send({ sourceIds: [member.id] })
        .expect(200);

      const search = (
        await api()
          .post('/search')
          .send({ query: 'What may a reviewer do?', projectId: project.id })
          .expect(200)
      ).body as SearchResponse;
      expect(search.results.length).toBeGreaterThan(0);
      expect(
        search.results.every((result) => result.sourceId === member.id),
      ).toBe(true);

      answer = 'A reviewer approves change requests [1].';
      const response = await bufferEventStream(
        api()
          .post('/chat')
          .send({ question: 'What may a reviewer do?', projectId: project.id }),
      );
      const done = parseEventStream(response.body as string).find(
        (event) => event.event === 'done',
      );
      const citations = (done?.data as ChatDoneEvent).citations;
      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({ sourceId: member.id });
      expect(['section', 'table_rows', 'lines']).toContain(
        citations[0].locator.kind,
      );
      const prompt = prompts[0].map((message) => message.content).join('\n');
      expect(prompt).not.toContain('(outsider)');
    });
  });
});
