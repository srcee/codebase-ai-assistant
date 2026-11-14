import { Logger, type INestApplication } from '@nestjs/common';
import type { ProjectResponse } from '@codebase-ai/contracts';
import { type DatabaseHandle, schema } from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  prepareDedicatedDatabase,
  sourceFactory,
} from '@codebase-ai/server-database/testing';
import { testConfig } from '@codebase-ai/server-testing';
import {
  assertNotLeaked,
  createProjectRequestFactory,
  faker,
} from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';

describeWithDatabase('projects API', (baseUrl) => {
  let app: INestApplication;
  let handle: DatabaseHandle;

  const api = () => authorizedAgent(app);
  const dbOptions = () => ({ transient: { db: handle.db } });
  const createProject = async (
    body: object = createProjectRequestFactory.build(),
  ): Promise<ProjectResponse> =>
    (await api().post('/projects').send(body).expect(201))
      .body as ProjectResponse;
  const newSource = () => sourceFactory.create({}, dbOptions());
  const replaceSources = (id: string, sourceIds: string[]) =>
    api().put(`/projects/${id}/sources`).send({ sourceIds });

  beforeAll(async () => {
    const prepared = await prepareDedicatedDatabase(baseUrl, 'projects');
    handle = prepared.handle;
    app = await createTestApp({
      config: testConfig({ DATABASE_URL: prepared.url }),
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await handle.db.delete(schema.projects);
    await handle.db.delete(schema.sources);
  });

  afterAll(async () => {
    await app?.close();
    await handle?.pool.end();
  });

  describe('create, list, get, update, delete', () => {
    it('creates a project with a trimmed name and no sources', async () => {
      const request = createProjectRequestFactory.build();
      const response = await api()
        .post('/projects')
        .send({ ...request, name: `  ${request.name}  ` })
        .expect(201);
      expect(response.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: request.name,
        description: request.description,
        sourceIds: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('creates a project without a description', async () => {
      const { name } = createProjectRequestFactory.build();
      const created = await createProject({ name });
      expect(created.description).toBeNull();
    });

    it('allows two projects with the same name', async () => {
      const { name } = createProjectRequestFactory.build();
      await createProject({ name });
      await createProject({ name });
      const list = await api().get('/projects').expect(200);
      expect(list.body).toHaveLength(2);
    });

    it('lists projects ordered by name with their sources', async () => {
      const source = await newSource();
      const second = await createProject({ name: 'beta' });
      const first = await createProject({ name: 'alpha' });
      await replaceSources(second.id, [source.id]).expect(200);

      const response = await api().get('/projects').expect(200);

      expect(
        (response.body as ProjectResponse[]).map((project) => [
          project.id,
          project.sourceIds,
        ]),
      ).toEqual([
        [first.id, []],
        [second.id, [source.id]],
      ]);
    });

    it('gets a project by id', async () => {
      const created = await createProject();
      const response = await api().get(`/projects/${created.id}`).expect(200);
      expect(response.body).toEqual(created);
    });

    it('updates the name and description', async () => {
      const created = await createProject();
      const update = createProjectRequestFactory.build();

      const response = await api()
        .patch(`/projects/${created.id}`)
        .send(update)
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.id,
        name: update.name,
        description: update.description,
      });
    });

    it('clears the description with null and keeps the name', async () => {
      const created = await createProject();
      const response = await api()
        .patch(`/projects/${created.id}`)
        .send({ description: null })
        .expect(200);
      expect(response.body).toMatchObject({
        name: created.name,
        description: null,
      });
    });

    it('deletes a project and keeps its sources', async () => {
      const source = await newSource();
      const created = await createProject();
      await replaceSources(created.id, [source.id]).expect(200);

      await api().delete(`/projects/${created.id}`).expect(204);

      await api().get(`/projects/${created.id}`).expect(404);
      expect(await handle.db.select().from(schema.sources)).toHaveLength(1);
      expect(await handle.db.select().from(schema.projectSources)).toEqual([]);
    });

    it('logs changes by id only', async () => {
      const lines: string[] = [];
      jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(
          (message: unknown) => void lines.push(String(message)),
        );
      const request = createProjectRequestFactory.build();

      const created = await createProject(request);
      await api().delete(`/projects/${created.id}`).expect(204);

      expect(lines).toContain(`Project created id=${created.id}`);
      expect(lines).toContain(`Project deleted id=${created.id}`);
      assertNotLeaked(lines, request.name, request.description ?? '');
    });

    it('returns 404 for an unknown id', async () => {
      const unknown = faker.string.uuid();
      await api().get(`/projects/${unknown}`).expect(404);
      await api().patch(`/projects/${unknown}`).send({ name: 'x' }).expect(404);
      await api().delete(`/projects/${unknown}`).expect(404);
      await replaceSources(unknown, []).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await api().get('/projects/not-a-uuid').expect(400);
      await api().delete('/projects/not-a-uuid').expect(400);
      await replaceSources('not-a-uuid', []).expect(400);
    });
  });

  describe('sources', () => {
    it('replaces the whole set', async () => {
      const [a, b, c] = [
        await newSource(),
        await newSource(),
        await newSource(),
      ];
      const created = await createProject();

      await replaceSources(created.id, [a.id, b.id]).expect(200);
      const response = await replaceSources(created.id, [c.id, b.id]).expect(
        200,
      );

      expect(new Set((response.body as ProjectResponse).sourceIds)).toEqual(
        new Set([b.id, c.id]),
      );
      const fetched = await api().get(`/projects/${created.id}`).expect(200);
      expect(fetched.body).toEqual(response.body);
    });

    it('empties the set', async () => {
      const source = await newSource();
      const created = await createProject();
      await replaceSources(created.id, [source.id]).expect(200);

      const response = await replaceSources(created.id, []).expect(200);

      expect((response.body as ProjectResponse).sourceIds).toEqual([]);
    });

    it('lets one source belong to several projects', async () => {
      const source = await newSource();
      const first = await createProject();
      const second = await createProject();
      await replaceSources(first.id, [source.id]).expect(200);
      await replaceSources(second.id, [source.id]).expect(200);

      const list = await api().get('/projects').expect(200);
      for (const project of list.body as ProjectResponse[]) {
        expect(project.sourceIds).toEqual([source.id]);
      }
    });

    it('rejects unknown source ids without echoing them and keeps the old set', async () => {
      const source = await newSource();
      const unknown = faker.string.uuid();
      const created = await createProject();
      await replaceSources(created.id, [source.id]).expect(200);

      const response = await replaceSources(created.id, [
        source.id,
        unknown,
      ]).expect(400);

      assertNotLeaked(response.body, unknown);
      const fetched = await api().get(`/projects/${created.id}`).expect(200);
      expect((fetched.body as ProjectResponse).sourceIds).toEqual([source.id]);
    });

    it('treats differently cased ids as the same source', async () => {
      const source = await newSource();
      const created = await createProject();
      await replaceSources(created.id, [
        source.id,
        source.id.toUpperCase(),
      ]).expect(400);
      await replaceSources(created.id, [source.id.toUpperCase()]).expect(200);
    });
  });

  describe('request validation', () => {
    it.each([
      ['missing name', {}],
      ['empty name', { name: '   ' }],
      ['non-string name', { name: faker.number.int() }],
      ['overlong name', { name: faker.string.alpha(101) }],
      ['control characters in name', { name: `${faker.lorem.word()}\u0007` }],
      [
        'overlong description',
        { name: faker.lorem.word(), description: faker.string.alpha(2001) },
      ],
      ['unknown field', { name: faker.lorem.word(), sourceIds: [] }],
    ])('rejects a create with %s', async (_label, body) => {
      await api().post('/projects').send(body).expect(400);
      await api().get('/projects').expect(200).expect([]);
    });

    it.each([
      ['a null name', { name: null }],
      ['an empty name', { name: ' ' }],
      ['an unknown field', { kind: 'other' }],
    ])('rejects an update with %s', async (_label, body) => {
      const created = await createProject();
      await api().patch(`/projects/${created.id}`).send(body).expect(400);
    });

    it.each([
      ['a missing list', {}],
      ['a non-array', { sourceIds: 'x' }],
      ['an invalid id', { sourceIds: ['nope'] }],
      [
        'a repeated id',
        { sourceIds: Array(2).fill('2f0c2b6e-6c5b-4a43-9d0b-6a3a2c1f9e11') },
      ],
      [
        'more than 100 ids',
        { sourceIds: Array.from({ length: 101 }, () => faker.string.uuid()) },
      ],
    ])('rejects a sources replacement with %s', async (_label, body) => {
      const created = await createProject();
      await api().put(`/projects/${created.id}/sources`).send(body).expect(400);
    });
  });
});
