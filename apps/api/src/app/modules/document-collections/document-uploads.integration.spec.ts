import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  ChatDoneEvent,
  DocumentChangesResponse,
  DocumentCollectionResponse,
  DocumentSummary,
  LatestIndexJobResponse,
  Page,
  ProjectResponse,
  SearchResponse,
  UploadDocumentsResponse,
} from '@codebase-ai/contracts';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  DATABASE_SETUP_TIMEOUT_MS,
  describeWithDatabase,
  documentFactory,
  prepareDedicatedDatabase,
  unitVector,
} from '@codebase-ai/server-database/testing';
import {
  createSandbox,
  type Sandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import type { Test } from 'supertest';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';
import {
  bufferEventStream,
  parseEventStream,
} from '../../../testing/event-stream';
import { sha256Hex } from '../ingestion/utils/sha256-hex';
import type { ChatMessage } from '../inference/types/chat-message';
import { CHAT_PORT } from '../inference/types/chat-port';
import { EMBEDDING_PORT } from '../inference/types/embedding-port';
import { IndexJobRunnerService } from '../indexing/services/index-job-runner.service';

const { chunks, documents, sourceFiles, sources } = schema;

const MAX_BYTES = 2048;
const MAX_FILES = 4;

interface UploadFile {
  path: string;
  content: string | Buffer;
}

describeWithDatabase('document uploads', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let box: Sandbox;
  let dataDir: string;
  let answer: string;
  const prompts: ChatMessage[][] = [];
  const embedBatch = jest.fn<Promise<number[][]>, [readonly string[]]>();

  const api = () => authorizedAgent(app);
  const runner = () => app.get(IndexJobRunnerService, { strict: false });
  const embeddedTexts = (): string[] =>
    embedBatch.mock.calls.flatMap(([texts]) => [...texts]);
  const word = () => faker.string.alpha({ length: 12, casing: 'lower' });

  const markdown = (heading: string, body: string) =>
    `# ${heading}\n\n## Permissions\n\n${body}\n`;

  const blobPath = (hash: string) =>
    join(dataDir, 'blobs', 'sha256', hash.slice(0, 2), hash);
  const tempFiles = () =>
    existsSync(join(dataDir, 'tmp')) ? readdirSync(join(dataDir, 'tmp')) : [];

  const createUploadCollection = async (name = 'Uploads'): Promise<string> =>
    (
      (
        await api()
          .post('/document-collections')
          .send({ name, origin: 'upload' })
          .expect(201)
      ).body as DocumentCollectionResponse
    ).id;

  const send = (id: string, files: readonly UploadFile[]): Test => {
    let request = api().post(`/document-collections/${id}/documents`);
    for (const file of files) {
      request = request
        .field('path', file.path)
        .attach('file', Buffer.from(file.content), 'upload.bin');
    }
    return request;
  };

  const upload = async (
    id: string,
    files: readonly UploadFile[],
  ): Promise<UploadDocumentsResponse> => {
    const response = (await send(id, files).expect(201))
      .body as UploadDocumentsResponse;
    await runner().whenIdle();
    return response;
  };

  const latest = async (id: string): Promise<LatestIndexJobResponse> =>
    (
      await api()
        .get(`/document-collections/${id}/index-jobs/latest`)
        .expect(200)
    ).body as LatestIndexJobResponse;

  const documentsOf = (id: string) =>
    handle.db.select().from(documents).where(eq(documents.sourceId, id));
  const chunksOf = (id: string) =>
    handle.db.select().from(chunks).where(eq(chunks.sourceId, id));

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
    box = createSandbox('caa-uploads-');
    dataDir = join(box.path, 'data');
    const prepared = await prepareDedicatedDatabase(baseUrl, 'uploads');
    handle = prepared.handle;
    app = await createTestApp({
      config: testConfig({
        DATABASE_URL: prepared.url,
        DATA_DIR: dataDir,
        ALLOWED_DOCUMENT_ROOTS: box.root,
        DOCUMENT_MAX_BYTES: String(MAX_BYTES),
        UPLOAD_MAX_FILES: String(MAX_FILES),
        INFERENCE_MAX_RETRIES: '0',
        INDEXING_EMBED_CONCURRENCY: '1',
        RETRIEVAL_DEBUG_ENDPOINT: 'true',
      }),
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
  }, DATABASE_SETUP_TIMEOUT_MS);

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

  describe('upload', () => {
    it('stores supported files, reports skips, and indexes by section', async () => {
      const id = await createUploadCollection();
      const role = word();
      const response = await upload(id, [
        { path: 'specs/roles.md', content: markdown('Roles', role) },
        { path: 'notes\\glossary.txt', content: `${word()}\n` },
        { path: '.env', content: `TOKEN=${CANARY_SECRET}` },
        { path: 'specs/matrix.xlsx', content: 'binary' },
      ]);

      expect(
        response.stored.map((document) => document.logicalPath).sort(),
      ).toEqual(['notes/glossary.txt', 'specs/roles.md']);
      expect(response.unchanged).toEqual([]);
      expect(response.skipped).toEqual([
        { logicalPath: '.env', reason: 'secret-filename' },
        { logicalPath: 'specs/matrix.xlsx', reason: 'unsupported-extension' },
      ]);
      expect(response.job).toMatchObject({ sourceId: id });
      assertNotLeaked(response, dataDir, CANARY_SECRET);

      const { job } = await latest(id);
      expect(job).toMatchObject({
        status: 'succeeded',
        filesIndexed: 2,
        filesFailed: 0,
      });
      const stored = await chunksOf(id);
      expect(
        stored.find((chunk) => chunk.content.includes(role))?.locator,
      ).toEqual({ kind: 'section', headingPath: ['Roles', 'Permissions'] });
      for (const document of await documentsOf(id)) {
        expect(existsSync(blobPath(document.blobHash))).toBe(true);
      }
      expect(tempFiles()).toEqual([]);
    });

    it('skips an oversized file with a reason and keeps the rest', async () => {
      const id = await createUploadCollection();
      const response = await upload(id, [
        { path: 'big.md', content: Buffer.alloc(MAX_BYTES + 1, 'a') },
        { path: 'exact.md', content: Buffer.alloc(MAX_BYTES, 'b') },
      ]);
      expect(response.skipped).toEqual([
        { logicalPath: 'big.md', reason: 'too-large' },
      ]);
      expect(response.stored.map((document) => document.logicalPath)).toEqual([
        'exact.md',
      ]);
      expect(tempFiles()).toEqual([]);
    });

    it('treats the same path and content as a no-op', async () => {
      const id = await createUploadCollection();
      const file = {
        path: 'specs/roles.md',
        content: markdown('Roles', word()),
      };
      const first = await upload(id, [file]);
      embedBatch.mockClear();

      const second = await upload(id, [file]);
      expect(second.stored).toEqual([]);
      expect(second.unchanged.map((document) => document.id)).toEqual([
        first.stored[0].id,
      ]);
      expect(second.job).toBeNull();
      expect(embedBatch).not.toHaveBeenCalled();
      expect(tempFiles()).toEqual([]);
    });

    it('re-indexes only the document whose content changed and drops its old blob', async () => {
      const id = await createUploadCollection();
      const kept = { path: 'specs/kept.md', content: markdown('Kept', word()) };
      const changed = {
        path: 'specs/roles.md',
        content: markdown('Roles', word()),
      };
      const first = await upload(id, [kept, changed]);
      const oldHash = sha256Hex(Buffer.from(changed.content));
      embedBatch.mockClear();

      const role = word();
      const second = await upload(id, [
        kept,
        { path: 'SPECS/Roles.md', content: markdown('Roles', role) },
      ]);
      expect(second.unchanged.map((document) => document.logicalPath)).toEqual([
        'specs/kept.md',
      ]);
      expect(second.stored).toEqual([
        expect.objectContaining({
          id: first.stored.find((d) => d.logicalPath === changed.path)?.id,
          logicalPath: 'SPECS/Roles.md',
        }),
      ]);
      expect(embeddedTexts().join('\n')).toContain(role);
      expect(embeddedTexts().join('\n')).not.toContain('Kept');
      expect(existsSync(blobPath(oldHash))).toBe(false);

      const files = await handle.db
        .select({ relativePath: sourceFiles.relativePath })
        .from(sourceFiles)
        .where(eq(sourceFiles.sourceId, id));
      expect(files.map((file) => file.relativePath).sort()).toEqual([
        'SPECS/Roles.md',
        'specs/kept.md',
      ]);
    });

    it('makes zero embedding calls on a sync with nothing changed', async () => {
      const id = await createUploadCollection();
      await upload(id, [{ path: 'a.md', content: markdown('A', word()) }]);
      embedBatch.mockClear();

      await api().post(`/document-collections/${id}/sync`).expect(202);
      await runner().whenIdle();
      expect((await latest(id)).job).toMatchObject({
        status: 'succeeded',
        filesDiscovered: 1,
      });
      expect(embedBatch).not.toHaveBeenCalled();
    });

    it('counts changes from document rows without reading blobs', async () => {
      const id = await createUploadCollection();
      await upload(id, [{ path: 'a.md', content: markdown('A', word()) }]);
      await documentFactory.create(
        { sourceId: id, logicalPath: 'b.md', sizeBytes: MAX_BYTES },
        { transient: { db: handle.db } },
      );
      const changes = (
        await api().get(`/document-collections/${id}/changes`).expect(200)
      ).body as DocumentChangesResponse;
      expect(changes).toEqual({ new: 1, changed: 0, removed: 0 });
    });

    it('fails a sync whose blob is missing without exposing paths', async () => {
      const id = await createUploadCollection();
      const row = await documentFactory.create(
        { sourceId: id, logicalPath: 'lost.md', sizeBytes: MAX_BYTES },
        { transient: { db: handle.db } },
      );
      await api().post(`/document-collections/${id}/sync`).expect(202);
      await runner().whenIdle();
      const { job } = await latest(id);
      expect(job.status).toBe('failed');
      expect(job.errorSummary).toContain('blob store');
      assertNotLeaked(job, dataDir, row.blobHash);
    });

    it('skips stored documents that no longer fit the limits without reading them', async () => {
      const id = await createUploadCollection();
      const create = { transient: { db: handle.db } };
      await documentFactory.create(
        { sourceId: id, logicalPath: 'big.md', sizeBytes: MAX_BYTES + 1 },
        create,
      );
      await documentFactory.create(
        { sourceId: id, logicalPath: 'legacy.xlsx', sizeBytes: 1 },
        create,
      );
      await api().post(`/document-collections/${id}/sync`).expect(202);
      await runner().whenIdle();

      const { job, issues } = await latest(id);
      expect(job).toMatchObject({ status: 'succeeded', filesSkipped: 2 });
      expect(issues).toEqual(
        expect.arrayContaining([
          { relativePath: 'big.md', status: 'skipped', reason: 'too-large' },
          {
            relativePath: 'legacy.xlsx',
            status: 'skipped',
            reason: 'unsupported-extension',
          },
        ]),
      );
    });
  });

  describe('rejections', () => {
    it('returns 409 while a sync is running and keeps nothing', async () => {
      const id = await createUploadCollection();
      const release = blockEmbeddings();
      await send(id, [{ path: 'a.md', content: markdown('A', word()) }]).expect(
        201,
      );
      await send(id, [{ path: 'b.md', content: markdown('B', word()) }]).expect(
        409,
      );
      release();
      await runner().whenIdle();
      expect(
        (await documentsOf(id)).map((document) => document.logicalPath),
      ).toEqual(['a.md']);
      expect(tempFiles()).toEqual([]);
    });

    it('returns 413 for too many files and keeps nothing', async () => {
      const id = await createUploadCollection();
      const files = Array.from({ length: MAX_FILES + 1 }, (_, index) => ({
        path: `doc-${index}.md`,
        content: markdown(`Doc ${index}`, word()),
      }));
      await send(id, files).expect(413);
      expect(await documentsOf(id)).toEqual([]);
      expect(tempFiles()).toEqual([]);
    });

    it.each([
      ['traversal', '../escape.md'],
      ['an absolute path', '/etc/roles.md'],
      ['a drive letter', 'C:\\docs\\roles.md'],
    ])('rejects %s and keeps nothing', async (_label, path) => {
      const id = await createUploadCollection();
      const response = await send(id, [
        { path: 'ok.md', content: markdown('Ok', word()) },
        { path, content: markdown('Bad', word()) },
      ]).expect(400);
      assertNotLeaked(response.body, path);
      expect(await documentsOf(id)).toEqual([]);
      expect(tempFiles()).toEqual([]);
    });

    it('rejects the same path twice in one upload', async () => {
      const id = await createUploadCollection();
      await send(id, [
        { path: 'roles.md', content: 'a' },
        { path: 'ROLES.md', content: 'b' },
      ]).expect(400);
      expect(await documentsOf(id)).toEqual([]);
    });

    it('rejects a file without a path field and a body that is not multipart', async () => {
      const id = await createUploadCollection();
      await api()
        .post(`/document-collections/${id}/documents`)
        .attach('file', Buffer.from('x'), 'a.md')
        .expect(400);
      await api()
        .post(`/document-collections/${id}/documents`)
        .send({ path: 'a.md' })
        .expect(400);
      await api()
        .post(`/document-collections/${id}/documents`)
        .field('path', 'a.md')
        .expect(400);
    });

    it('rejects folder collections and unknown ids', async () => {
      const folder = join(box.root, 'docs');
      mkdirSync(folder, { recursive: true });
      const created = (
        await api()
          .post('/document-collections')
          .send({ name: 'Folder', origin: 'folder', path: folder })
          .expect(201)
      ).body as DocumentCollectionResponse;
      await send(created.id, [{ path: 'a.md', content: 'a' }]).expect(400);
      await api()
        .delete(
          `/document-collections/${created.id}/documents/${faker.string.uuid()}`,
        )
        .expect(400);

      const unknown = faker.string.uuid();
      await send(unknown, [{ path: 'a.md', content: 'a' }]).expect(404);
      await api()
        .delete(`/document-collections/${unknown}/documents/${unknown}`)
        .expect(404);
    });
  });

  describe('list', () => {
    const list = async (id: string, query: string) =>
      (
        await api()
          .get(`/document-collections/${id}/documents${query}`)
          .expect(200)
      ).body as Page<DocumentSummary>;

    it('pages documents by path ignoring case without the blob hash', async () => {
      const id = await createUploadCollection();
      const create = { transient: { db: handle.db } };
      const rows = [];
      for (const logicalPath of ['b.md', 'A.md', 'specs/c.md']) {
        rows.push(
          await documentFactory.create({ sourceId: id, logicalPath }, create),
        );
      }

      const first = await list(id, '?limit=2');
      expect(first.items.map((item) => item.logicalPath)).toEqual([
        'A.md',
        'b.md',
      ]);
      expect(first.nextCursor).not.toBeNull();
      const second = await list(
        id,
        `?limit=2&cursor=${encodeURIComponent(String(first.nextCursor))}`,
      );
      expect(second).toEqual({
        items: [expect.objectContaining({ logicalPath: 'specs/c.md' })],
        nextCursor: null,
      });
      assertNotLeaked([first, second], ...rows.map((row) => row.blobHash));
    });

    it('rejects folder collections, unknown ids, and bad cursors', async () => {
      const folder = join(box.root, 'listed');
      mkdirSync(folder, { recursive: true });
      const created = (
        await api()
          .post('/document-collections')
          .send({ name: 'Folder', origin: 'folder', path: folder })
          .expect(201)
      ).body as DocumentCollectionResponse;
      await api()
        .get(`/document-collections/${created.id}/documents`)
        .expect(400);
      await api()
        .get(`/document-collections/${faker.string.uuid()}/documents`)
        .expect(404);

      const id = await createUploadCollection();
      await api()
        .get(`/document-collections/${id}/documents?cursor=not-a-cursor`)
        .expect(400);
      await api()
        .get(`/document-collections/${id}/documents?limit=0`)
        .expect(400);
    });
  });

  describe('delete', () => {
    it('removes a document, its chunks, and its blob once unreferenced', async () => {
      const content = markdown('Shared', word());
      const first = await createUploadCollection('First');
      const second = await createUploadCollection('Second');
      const uploaded = await upload(first, [
        { path: 'shared.md', content },
        { path: 'own.md', content: markdown('Own', word()) },
      ]);
      await upload(second, [{ path: 'copy.md', content }]);
      const sharedHash = sha256Hex(Buffer.from(content));
      const shared = uploaded.stored.find((d) => d.logicalPath === 'shared.md');
      const own = uploaded.stored.find((d) => d.logicalPath === 'own.md');
      const ownHash = (await documentsOf(first)).find(
        (row) => row.id === own?.id,
      )?.blobHash;

      await api()
        .delete(`/document-collections/${first}/documents/${shared?.id}`)
        .expect(204);
      await api()
        .delete(`/document-collections/${first}/documents/${own?.id}`)
        .expect(204);

      expect(await documentsOf(first)).toEqual([]);
      expect(await chunksOf(first)).toEqual([]);
      expect(existsSync(blobPath(sharedHash))).toBe(true);
      expect(existsSync(blobPath(String(ownHash)))).toBe(false);
      await api()
        .delete(`/document-collections/${first}/documents/${own?.id}`)
        .expect(404);
    });

    it('removes the blobs of a deleted collection', async () => {
      const id = await createUploadCollection();
      await upload(id, [{ path: 'a.md', content: markdown('A', word()) }]);
      const [row] = await documentsOf(id);
      await api().delete(`/document-collections/${id}`).expect(204);
      expect(existsSync(blobPath(row.blobHash))).toBe(false);
    });
  });

  describe('search and chat', () => {
    it('finds and cites an upload collection only within its project', async () => {
      const member = await createUploadCollection('Member');
      const outsider = await createUploadCollection('Outsider');
      await upload(member, [
        {
          path: 'roles.md',
          content: markdown('Reviewer', 'A reviewer approves change requests.'),
        },
      ]);
      await upload(outsider, [
        {
          path: 'roles.md',
          content: markdown(
            'Reviewer',
            'A reviewer deletes projects (outsider).',
          ),
        },
      ]);
      const project = (
        await api().post('/projects').send({ name: 'Docs' }).expect(201)
      ).body as ProjectResponse;
      await api()
        .put(`/projects/${project.id}/sources`)
        .send({ sourceIds: [member] })
        .expect(200);

      const search = (
        await api()
          .post('/search')
          .send({ query: 'What may a reviewer do?', projectId: project.id })
          .expect(200)
      ).body as SearchResponse;
      expect(search.results.length).toBeGreaterThan(0);
      expect(search.results.every((result) => result.sourceId === member)).toBe(
        true,
      );
      expect(search.results[0]).toMatchObject({
        relativePath: 'roles.md',
        locator: { kind: 'section' },
      });

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
      expect(citations[0]).toMatchObject({
        sourceId: member,
        locator: { kind: 'section' },
      });
      const prompt = prompts[0].map((message) => message.content).join('\n');
      expect(prompt).not.toContain('(outsider)');
    });
  });

  it('logs ids and counts only', async () => {
    const messages: unknown[] = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => void messages.push(args));
    }
    const secretPath = `${word()}/${word()}.md`;
    const id = await createUploadCollection();
    const uploaded = await upload(id, [
      { path: secretPath, content: markdown('Roles', CANARY_SECRET) },
      { path: '.env', content: CANARY_SECRET },
    ]);
    await api()
      .delete(`/document-collections/${id}/documents/${uploaded.stored[0].id}`)
      .expect(204);

    const logged = JSON.stringify(messages);
    expect(logged).toContain(id);
    assertNotLeaked(logged, CANARY_SECRET, secretPath, dataDir);
  });
});
