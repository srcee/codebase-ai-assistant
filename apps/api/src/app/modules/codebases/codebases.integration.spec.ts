import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import type { CodebaseResponse } from '@codebase-ai/contracts';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import {
  createDatabase,
  type DatabaseHandle,
  EMBEDDING_DIMENSIONS,
  runMigrations,
  schema,
} from '@codebase-ai/server-database';
import { AppModule } from '../../app.module';
import { configureApp } from '../../configure-app';

const envFile = join(__dirname, '..', '..', '..', '..', '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const baseUrl = process.env['TEST_DATABASE_URL'];
if (!baseUrl) {
  console.warn(
    'TEST_DATABASE_URL is not set; skipping API database integration tests.',
  );
}
const describeDb = baseUrl ? describe : describe.skip;

/**
 * The schema suite in server-database drops the public schema, so this suite gets its own
 * database to stay safe when Nx runs both projects in parallel.
 */
async function prepareDedicatedDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const baseName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(baseName)) {
    throw new Error(
      'TEST_DATABASE_URL must point at a database whose name ends in _test',
    );
  }
  const dedicatedName = `${baseName.replace(/_test$/, '')}_api_test`;

  const admin = new Pool({ connectionString });
  try {
    const existing = await admin.query(
      'select 1 from pg_database where datname = $1',
      [dedicatedName],
    );
    if (existing.rowCount === 0) {
      await admin.query(`create database "${dedicatedName}"`);
    }
  } finally {
    await admin.end();
  }

  url.pathname = `/${dedicatedName}`;
  const dedicatedUrl = url.toString();
  const handle = createDatabase(dedicatedUrl);
  await handle.pool.query('drop schema if exists public cascade');
  await handle.pool.query('drop schema if exists drizzle cascade');
  await handle.pool.query('create schema public');
  await runMigrations(handle.db);
  return { handle, dedicatedUrl };
}

describeDb('codebases API', () => {
  let app: INestApplication;
  let handle: DatabaseHandle;
  let sandbox: string;
  let root: string;
  let outside: string;

  const server = () => app.getHttpServer();
  const register = (body: object) =>
    request(server()).post('/codebases').send(body);
  const registerCodebase = async (name: string): Promise<CodebaseResponse> =>
    (await register({ path: join(root, name) }).expect(201))
      .body as CodebaseResponse;

  const makeRepository = (parent: string, name: string) =>
    mkdirSync(join(parent, name, '.git'), { recursive: true });

  beforeAll(async () => {
    sandbox = realpathSync.native(mkdtempSync(join(tmpdir(), 'caa-api-')));
    root = join(sandbox, 'root');
    outside = join(sandbox, 'outside');
    for (const name of ['alpha', 'beta', 'gamma']) makeRepository(root, name);
    makeRepository(outside, 'secret');
    mkdirSync(join(root, 'plain'), { recursive: true });
    symlinkSync(join(root, 'alpha'), join(root, 'alpha-alias'), 'junction');
    symlinkSync(join(outside, 'secret'), join(root, 'escape'), 'junction');

    const prepared = await prepareDedicatedDatabase(baseUrl as string);
    handle = prepared.handle;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadConfig({
          DATABASE_URL: prepared.dedicatedUrl,
          ALLOWED_REPO_ROOTS: root,
        }),
      )
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await handle.db.delete(schema.repositories);
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
    if (sandbox) rmSync(sandbox, { recursive: true, force: true });
  });

  describe('register, list, get, delete', () => {
    it('registers a codebase and returns display data only', async () => {
      const response = await register({ path: join(root, 'alpha') }).expect(
        201,
      );
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
      const response = await register({
        path: join(root, 'alpha'),
        name: '  My Codebase  ',
      }).expect(201);
      expect(response.body.name).toBe('My Codebase');
    });

    it('lists registered codebases ordered by name', async () => {
      await registerCodebase('gamma');
      await registerCodebase('alpha');
      const response = await request(server()).get('/codebases').expect(200);
      expect(
        (response.body as CodebaseResponse[]).map((item) => item.name),
      ).toEqual(['alpha', 'gamma']);
    });

    it('lists nothing when no codebases are registered', async () => {
      await request(server()).get('/codebases').expect(200).expect([]);
    });

    it('gets a codebase by id', async () => {
      const created = await registerCodebase('beta');
      const response = await request(server())
        .get(`/codebases/${created.id}`)
        .expect(200);
      expect(response.body).toEqual(created);
    });

    it('deletes a codebase', async () => {
      const created = await registerCodebase('beta');
      await request(server()).delete(`/codebases/${created.id}`).expect(204);
      await request(server()).get(`/codebases/${created.id}`).expect(404);
      await request(server()).get('/codebases').expect(200).expect([]);
    });

    it('returns 404 for an unknown id', async () => {
      const unknown = '00000000-0000-4000-8000-000000000000';
      await request(server()).get(`/codebases/${unknown}`).expect(404);
      await request(server()).delete(`/codebases/${unknown}`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(server()).get('/codebases/not-a-uuid').expect(400);
      await request(server()).delete('/codebases/not-a-uuid').expect(400);
    });
  });

  describe('duplicates', () => {
    it('returns 409 for the same path', async () => {
      await registerCodebase('alpha');
      await register({ path: join(root, 'alpha') }).expect(409);
    });

    it('returns 409 when a link resolves to a registered path', async () => {
      await registerCodebase('alpha');
      await register({ path: join(root, 'alpha-alias') }).expect(409);
      const list = await request(server()).get('/codebases').expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('returns 409 for a trailing-separator variant', async () => {
      await registerCodebase('alpha');
      await register({ path: `${join(root, 'alpha')}/` }).expect(409);
    });

    it('allows the same path again after deletion', async () => {
      const created = await registerCodebase('alpha');
      await request(server()).delete(`/codebases/${created.id}`).expect(204);
      await registerCodebase('alpha');
    });
  });

  describe('request validation', () => {
    it.each([
      ['missing path', {}],
      ['non-string path', { path: 42 }],
      ['empty path', { path: '' }],
      ['unknown field', { path: 'x', extra: true }],
      ['non-string name', { path: 'x', name: 7 }],
      ['empty name', { path: 'x', name: '   ' }],
      ['overlong name', { path: 'x', name: 'n'.repeat(101) }],
      ['control characters in name', { path: 'x', name: 'a\u0007b' }],
    ])('rejects %s', async (_name, body) => {
      await register(body).expect(400);
    });

    it('does not store anything for rejected requests', async () => {
      await register({ path: join(root, 'alpha'), extra: true }).expect(400);
      await request(server()).get('/codebases').expect(200).expect([]);
    });
  });

  describe('path policy', () => {
    it.each([
      ['a path outside the allowed roots', () => join(outside, 'secret')],
      ['a link escaping the root', () => join(root, 'escape')],
      ['a traversal path', () => `${root}/alpha/../../outside/secret`],
      ['a missing path', () => join(root, 'missing')],
      ['a directory without .git', () => join(root, 'plain')],
      ['a relative path', () => 'alpha'],
      ['a UNC path', () => '\\\\server\\share\\repo'],
    ])('rejects %s without echoing it', async (_name, path) => {
      const input = path();
      const response = await register({ path: input }).expect(400);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(sandbox);
      expect(body).not.toContain('secret');
      expect(body).not.toContain('server');
      await request(server()).get('/codebases').expect(200).expect([]);
    });

    it('never exposes absolute paths in any response', async () => {
      const created = await registerCodebase('alpha');
      const responses = [
        JSON.stringify(created),
        JSON.stringify(
          (await request(server()).get('/codebases').expect(200)).body,
        ),
        JSON.stringify(
          (await request(server()).get(`/codebases/${created.id}`)).body,
        ),
      ];
      for (const body of responses) {
        expect(body).not.toContain(sandbox);
        expect(body).not.toContain(root);
        expect(body).not.toMatch(/canonical/i);
      }
    });
  });

  describe('deletion cascade', () => {
    it('removes files, chunks, and jobs with the codebase', async () => {
      const created = await registerCodebase('alpha');
      const [file] = await handle.db
        .insert(schema.repositoryFiles)
        .values({
          repositoryId: created.id,
          relativePath: 'src/a.ts',
          contentHash: 'file-hash',
          sizeBytes: 10,
          status: 'indexed',
        })
        .returning();
      await handle.db
        .insert(schema.indexJobs)
        .values({ repositoryId: created.id });
      await handle.db.insert(schema.codeChunks).values({
        repositoryId: created.id,
        fileId: file.id,
        chunkHash: 'chunk-hash',
        symbolName: 'main',
        startLine: 1,
        endLine: 2,
        content: 'export const main = 1;',
        embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5),
        embeddingModel: 'test-model',
        chunkingVersion: '1',
      });

      await request(server()).delete(`/codebases/${created.id}`).expect(204);

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
      await handle.db
        .insert(schema.indexJobs)
        .values([{ repositoryId: first.id }, { repositoryId: second.id }]);

      await request(server()).delete(`/codebases/${first.id}`).expect(204);

      const { rows } = await handle.pool.query<{ repository_id: string }>(
        'select repository_id from index_jobs',
      );
      expect(rows.map((row) => row.repository_id)).toEqual([second.id]);
    });
  });
});
