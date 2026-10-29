import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import type { CodebaseResponse } from '@codebase-ai/contracts';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  codeChunkFactory,
  describeWithDatabase,
  indexJobFactory,
  prepareDedicatedDatabase,
  repositoryFileFactory,
} from '@codebase-ai/server-database/testing';
import {
  createSandbox,
  linkDirectory,
  makeGitRepository,
  type Sandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';

// The schema suite in server-database drops the public schema, so this suite gets its own database.
describeWithDatabase('codebases API', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let box: Sandbox;

  // Distinct tokens so "not echoed" assertions cannot match unrelated text.
  const secretName = `secret-${faker.string.alphanumeric(10)}`;
  const serverName = `srv-${faker.string.alphanumeric(10)}`;

  const api = () => authorizedAgent(app);
  const register = (body: object) => api().post('/codebases').send(body);
  const registerCodebase = async (name: string): Promise<CodebaseResponse> =>
    (await register({ path: join(box.root, name) }).expect(201))
      .body as CodebaseResponse;
  const dbOptions = () => ({ transient: { db: handle.db } });

  beforeAll(async () => {
    box = createSandbox('caa-api-');
    for (const name of ['alpha', 'beta', 'gamma']) {
      makeGitRepository(box.root, name);
    }
    makeGitRepository(box.outside, secretName);
    mkdirSync(join(box.root, 'plain'), { recursive: true });
    linkDirectory(join(box.root, 'alpha'), join(box.root, 'alpha-alias'));
    linkDirectory(join(box.outside, secretName), join(box.root, 'escape'));

    const prepared = await prepareDedicatedDatabase(baseUrl, 'api');
    handle = prepared.handle;
    app = await createTestApp({
      config: testConfig({
        DATABASE_URL: prepared.url,
        ALLOWED_REPO_ROOTS: box.root,
      }),
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await handle.db.delete(schema.repositories);
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
    box?.dispose();
  });

  describe('register, list, get, delete', () => {
    it('registers a codebase and returns display data only', async () => {
      const response = await register({
        path: join(box.root, 'alpha'),
      }).expect(201);
      expect(response.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'alpha',
        relativePath: 'alpha',
        status: 'registered',
        lastIndexedCommit: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('uses the requested name, trimmed', async () => {
      const name = faker.lorem.words(2);
      const response = await register({
        path: join(box.root, 'alpha'),
        name: `  ${name}  `,
      }).expect(201);
      expect(response.body.name).toBe(name);
    });

    it('lists registered codebases ordered by name', async () => {
      await registerCodebase('gamma');
      await registerCodebase('alpha');
      const response = await api().get('/codebases').expect(200);
      expect(
        (response.body as CodebaseResponse[]).map((item) => item.name),
      ).toEqual(['alpha', 'gamma']);
    });

    it('lists nothing when no codebases are registered', async () => {
      await api().get('/codebases').expect(200).expect([]);
    });

    it('gets a codebase by id', async () => {
      const created = await registerCodebase('beta');
      const response = await api().get(`/codebases/${created.id}`).expect(200);
      expect(response.body).toEqual(created);
    });

    it('deletes a codebase', async () => {
      const created = await registerCodebase('beta');
      await api().delete(`/codebases/${created.id}`).expect(204);
      await api().get(`/codebases/${created.id}`).expect(404);
      await api().get('/codebases').expect(200).expect([]);
    });

    it('logs registration and deletion by id only', async () => {
      const lines: string[] = [];
      jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(
          (message: unknown) => void lines.push(String(message)),
        );

      const created = await registerCodebase('alpha');
      await api().delete(`/codebases/${created.id}`).expect(204);

      expect(lines).toContain(`Codebase registered id=${created.id}`);
      expect(lines).toContain(`Codebase deleted id=${created.id}`);
      assertNotLeaked(lines, box.path, box.root);
    });

    it('returns 404 for an unknown id', async () => {
      const unknown = faker.string.uuid();
      await api().get(`/codebases/${unknown}`).expect(404);
      await api().delete(`/codebases/${unknown}`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await api().get('/codebases/not-a-uuid').expect(400);
      await api().delete('/codebases/not-a-uuid').expect(400);
    });
  });

  describe('duplicates', () => {
    it('returns 409 for the same path', async () => {
      await registerCodebase('alpha');
      await register({ path: join(box.root, 'alpha') }).expect(409);
    });

    it('returns 409 when a link resolves to a registered path', async () => {
      await registerCodebase('alpha');
      await register({ path: join(box.root, 'alpha-alias') }).expect(409);
      const list = await api().get('/codebases').expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('returns 409 for a trailing-separator variant', async () => {
      await registerCodebase('alpha');
      await register({ path: `${join(box.root, 'alpha')}/` }).expect(409);
    });

    it('allows the same path again after deletion', async () => {
      const created = await registerCodebase('alpha');
      await api().delete(`/codebases/${created.id}`).expect(204);
      await registerCodebase('alpha');
    });
  });

  describe('request validation', () => {
    const anyPath = faker.system.directoryPath();

    it.each([
      ['missing path', {}],
      ['non-string path', { path: faker.number.int() }],
      ['empty path', { path: '' }],
      ['unknown field', { path: anyPath, extra: true }],
      ['non-string name', { path: anyPath, name: faker.number.int() }],
      ['empty name', { path: anyPath, name: '   ' }],
      ['overlong name', { path: anyPath, name: faker.string.alpha(101) }],
      [
        'control characters in name',
        { path: anyPath, name: `${faker.lorem.word()}\u0007` },
      ],
    ])('rejects %s', async (_name, body) => {
      await register(body).expect(400);
    });

    it('does not store anything for rejected requests', async () => {
      await register({ path: join(box.root, 'alpha'), extra: true }).expect(
        400,
      );
      await api().get('/codebases').expect(200).expect([]);
    });
  });

  describe('path policy', () => {
    it.each([
      ['a path outside the allowed roots', () => join(box.outside, secretName)],
      ['a link escaping the root', () => join(box.root, 'escape')],
      [
        'a traversal path',
        () => `${box.root}/alpha/../../outside/${secretName}`,
      ],
      ['a missing path', () => join(box.root, 'missing')],
      ['a directory without .git', () => join(box.root, 'plain')],
      ['a relative path', () => 'alpha'],
      ['a UNC path', () => `\\\\${serverName}\\share\\repo`],
    ])('rejects %s without echoing it', async (_name, path) => {
      const response = await register({ path: path() }).expect(400);
      assertNotLeaked(response.body, box.path, secretName, serverName);
      await api().get('/codebases').expect(200).expect([]);
    });

    it('never exposes absolute paths in any response', async () => {
      const created = await registerCodebase('alpha');
      const responses = [
        created,
        (await api().get('/codebases').expect(200)).body,
        (await api().get(`/codebases/${created.id}`)).body,
      ];
      for (const body of responses) {
        assertNotLeaked(body, box.path, box.root);
        expect(JSON.stringify(body)).not.toMatch(/canonical/i);
      }
    });
  });

  describe('deletion cascade', () => {
    it('removes files, chunks, and jobs with the codebase', async () => {
      const created = await registerCodebase('alpha');
      const file = await repositoryFileFactory.create(
        { repositoryId: created.id },
        dbOptions(),
      );
      await indexJobFactory.create({ repositoryId: created.id }, dbOptions());
      await codeChunkFactory.create(
        { repositoryId: created.id, fileId: file.id },
        dbOptions(),
      );

      await api().delete(`/codebases/${created.id}`).expect(204);

      const count = async (table: string) =>
        (
          await handle.pool.query<{ n: number }>(
            `select count(*)::int as n from ${table}`,
          )
        ).rows[0].n;
      expect(await count('repository_files')).toBe(0);
      expect(await count('code_chunks')).toBe(0);
      expect(await count('index_jobs')).toBe(0);
    });

    it('keeps other codebases intact', async () => {
      const first = await registerCodebase('alpha');
      const second = await registerCodebase('beta');
      await indexJobFactory.create({ repositoryId: first.id }, dbOptions());
      await indexJobFactory.create({ repositoryId: second.id }, dbOptions());

      await api().delete(`/codebases/${first.id}`).expect(204);

      const { rows } = await handle.pool.query<{ repository_id: string }>(
        'select repository_id from index_jobs',
      );
      expect(rows.map((row) => row.repository_id)).toEqual([second.id]);
    });
  });
});
