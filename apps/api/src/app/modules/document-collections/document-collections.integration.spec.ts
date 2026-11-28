import { mkdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  CodebaseResponse,
  DocumentCollectionResponse,
} from '@codebase-ai/contracts';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  chunkFactory,
  DATABASE_SETUP_TIMEOUT_MS,
  describeWithDatabase,
  indexJobFactory,
  prepareDedicatedDatabase,
  projectFactory,
  projectSourceFactory,
  sourceFileFactory,
} from '@codebase-ai/server-database/testing';
import {
  createSandbox,
  makeGitRepository,
  type Sandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';

const { chunks, indexJobs, projectSources, sourceFiles, sources } = schema;

describeWithDatabase('document collections API', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let box: Sandbox;
  let documentsRoot: string;
  let repositoriesRoot: string;

  // A distinct token so "not echoed" assertions cannot match unrelated text.
  const secretName = `secret-${faker.string.alphanumeric(10)}`;

  const api = () => authorizedAgent(app);
  const register = (body: object) =>
    api().post('/document-collections').send(body);
  const registerFolder = async (
    folder: string,
    name = folder,
  ): Promise<DocumentCollectionResponse> =>
    (
      await register({
        name,
        origin: 'folder',
        path: join(documentsRoot, folder),
      }).expect(201)
    ).body as DocumentCollectionResponse;
  const dbOptions = () => ({ transient: { db: handle.db } });

  beforeAll(async () => {
    box = createSandbox('caa-collections-');
    documentsRoot = join(box.root, 'documents');
    repositoriesRoot = join(box.root, 'repositories');
    for (const folder of ['specs', 'guides', 'nested/deep']) {
      mkdirSync(join(documentsRoot, folder), { recursive: true });
    }
    makeGitRepository(repositoriesRoot, 'service');
    mkdirSync(join(box.outside, secretName), { recursive: true });

    const prepared = await prepareDedicatedDatabase(baseUrl, 'collections');
    handle = prepared.handle;
    app = await createTestApp({
      config: testConfig({
        DATABASE_URL: prepared.url,
        ALLOWED_DOCUMENT_ROOTS: documentsRoot,
        ALLOWED_REPO_ROOTS: [repositoriesRoot, documentsRoot].join(delimiter),
        REPO_REQUIRE_GIT_DIR: 'false',
      }),
    });
  }, DATABASE_SETUP_TIMEOUT_MS);

  afterEach(async () => {
    jest.restoreAllMocks();
    await handle.db.delete(schema.projects);
    await handle.db.delete(sources);
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
    box?.dispose();
  });

  describe('register, list, get, delete', () => {
    it('registers a folder without .git and returns display data only', async () => {
      const response = await register({
        name: '  Product specs  ',
        origin: 'folder',
        path: join(documentsRoot, 'nested', 'deep'),
      }).expect(201);
      expect(response.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'Product specs',
        origin: 'folder',
        relativePath: 'nested/deep',
        status: 'registered',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      assertNotLeaked(response.body, documentsRoot);
    });

    it('registers an upload collection without a path', async () => {
      const response = await register({
        name: 'Uploads',
        origin: 'upload',
      }).expect(201);
      expect(response.body).toMatchObject({
        name: 'Uploads',
        origin: 'upload',
        relativePath: null,
        status: 'registered',
      });
      await register({ name: 'Uploads', origin: 'upload' }).expect(201);
    });

    it('lists only document collections, ordered by name', async () => {
      await registerFolder('specs', 'Specs');
      await registerFolder('guides', 'Guides');
      await api()
        .post('/codebases')
        .send({ path: join(repositoriesRoot, 'service') })
        .expect(201);

      const response = await api().get('/document-collections').expect(200);
      expect(
        (response.body as DocumentCollectionResponse[]).map(
          (item) => item.name,
        ),
      ).toEqual(['Guides', 'Specs']);
    });

    it('gets a collection by id and keeps codebases out of reach', async () => {
      const created = await registerFolder('specs');
      await api()
        .get(`/document-collections/${created.id}`)
        .expect(200)
        .expect(created);

      const codebase = (
        await api()
          .post('/codebases')
          .send({ path: join(repositoriesRoot, 'service') })
          .expect(201)
      ).body as CodebaseResponse;
      await api().get(`/document-collections/${codebase.id}`).expect(404);
      await api().delete(`/document-collections/${codebase.id}`).expect(404);
      await api().get(`/codebases/${created.id}`).expect(404);
    });

    it('deletes a collection with its files, chunks, jobs, and project links', async () => {
      const created = await registerFolder('specs');
      const file = await sourceFileFactory.create(
        { sourceId: created.id },
        dbOptions(),
      );
      await chunkFactory.create(
        { sourceId: created.id, fileId: file.id },
        dbOptions(),
      );
      await indexJobFactory.create(
        { sourceId: created.id, status: 'succeeded' },
        dbOptions(),
      );
      const project = await projectFactory.create({}, dbOptions());
      await projectSourceFactory.create(
        { projectId: project.id, sourceId: created.id },
        dbOptions(),
      );

      await api().delete(`/document-collections/${created.id}`).expect(204);

      for (const table of [sourceFiles, chunks, indexJobs, projectSources]) {
        expect(
          await handle.db
            .select()
            .from(table)
            .where(eq(table.sourceId, created.id)),
        ).toEqual([]);
      }
      await api().get(`/document-collections/${created.id}`).expect(404);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      await api()
        .get(`/document-collections/${faker.string.uuid()}`)
        .expect(404);
      await api()
        .delete(`/document-collections/${faker.string.uuid()}`)
        .expect(404);
      await api().get('/document-collections/not-a-uuid').expect(400);
    });
  });

  describe('validation and path policy', () => {
    it.each([
      [
        'no name',
        () => ({ origin: 'folder', path: join(documentsRoot, 'specs') }),
      ],
      [
        'a name with control characters',
        () => ({
          name: 'specs\u0007',
          origin: 'folder',
          path: join(documentsRoot, 'specs'),
        }),
      ],
      [
        'an upload origin with a path',
        () => ({
          name: 'uploads',
          origin: 'upload',
          path: join(documentsRoot, 'specs'),
        }),
      ],
      ['an unknown origin', () => ({ name: 'remote', origin: 'remote' })],
      ['no path', () => ({ name: 'specs', origin: 'folder' })],
      [
        'an unknown field',
        () => ({
          name: 'specs',
          origin: 'folder',
          path: join(documentsRoot, 'specs'),
          model: 'remote',
        }),
      ],
      [
        'a relative path',
        () => ({ name: 'specs', origin: 'folder', path: 'specs' }),
      ],
    ])('rejects %s with 400', async (_, body) => {
      await register(body()).expect(400);
    });

    it('rejects a folder outside the document roots without echoing it', async () => {
      const response = await register({
        name: 'secret',
        origin: 'folder',
        path: join(box.outside, secretName),
      }).expect(400);
      expect(response.body.message).toContain('allowed document root');
      assertNotLeaked(response.body, secretName);
    });

    it('rejects a repository root that is not a document root', async () => {
      await register({
        name: 'service',
        origin: 'folder',
        path: join(repositoriesRoot, 'service'),
      }).expect(400);
    });

    it('returns 409 for a folder that is already registered as any source', async () => {
      await registerFolder('specs');
      await register({
        name: 'again',
        origin: 'folder',
        path: join(documentsRoot, 'specs'),
      }).expect(409);

      await api()
        .post('/codebases')
        .send({ path: join(documentsRoot, 'guides') })
        .expect(201);
      await register({
        name: 'guides',
        origin: 'folder',
        path: join(documentsRoot, 'guides'),
      }).expect(409);
    });
  });

  it('logs ids only', async () => {
    const messages: unknown[] = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((...args: unknown[]) => void messages.push(args));
    const created = await registerFolder('specs', secretName);
    await api().delete(`/document-collections/${created.id}`).expect(204);

    expect(JSON.stringify(messages)).toContain(created.id);
    assertNotLeaked(JSON.stringify(messages), secretName, documentsRoot);
  });
});
