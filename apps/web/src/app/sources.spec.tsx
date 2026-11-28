import type {
  DocumentCollectionResponse,
  LatestIndexJobResponse,
  UploadDocumentsResponse,
} from '@codebase-ai/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  codebaseResponseFactory,
  documentCollectionResponseFactory,
  documentSummaryFactory,
  faker,
  indexJobResponseFactory,
} from '@codebase-ai/shared-testing';
import { json, mockApi } from '../testing/mock-api';
import App from './app';
import { POLL_INTERVAL_MS } from './hooks/use-index-job';

type Routes = Parameters<typeof mockApi>[0];

const noJob = () => json(404, { message: 'No index job yet.' });
const latest = (value: LatestIndexJobResponse) => () => json(200, value);

const calls = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET') === method)
    .map(([url, init]) => ({ url: String(url), init }));

const openSources = async (routes: Routes) => {
  const fetchMock = mockApi(routes);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
  await screen.findByRole('heading', { name: 'Repositories' });
  return fetchMock;
};

const card = (name: string) => screen.findByRole('listitem', { name });

describe('Sources view', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists repositories and collections with their status', async () => {
    const codebase = codebaseResponseFactory.build({ status: 'ready' });
    const job = indexJobResponseFactory.build({ sourceId: codebase.id });
    const collection = documentCollectionResponseFactory.build({
      origin: 'folder',
      relativePath: 'product/specs',
    });
    await openSources({
      'GET /codebases': () => json(200, [codebase]),
      'GET /document-collections': () => json(200, [collection]),
      [`GET /codebases/${codebase.id}/index-jobs/latest`]: latest({
        job,
        issues: [],
      }),
      [`GET /document-collections/${collection.id}/index-jobs/latest`]: noJob,
      [`GET /document-collections/${collection.id}/changes`]: () =>
        json(200, { new: 2, changed: 1, removed: 0 }),
    });

    const repository = await card(codebase.name);
    expect(within(repository).getByText('ready')).toBeTruthy();
    expect(await within(repository).findByText(/Job succeeded/)).toBeTruthy();
    const folder = await card(collection.name);
    expect(await within(folder).findByText('Not indexed yet.')).toBeTruthy();
    expect(await within(folder).findByText('3 changes available')).toBeTruthy();
    expect(within(folder).getByText('product/specs')).toBeTruthy();
  });

  it('registers a repository and shows a server validation error', async () => {
    const created = codebaseResponseFactory.build();
    let registered = false;
    const message = faker.lorem.sentence();
    const fetchMock = await openSources({
      'GET /codebases': () => json(200, registered ? [created] : []),
      'POST /codebases': (init) => {
        const body = JSON.parse(String(init?.body)) as { path: string };
        if (body.path === 'C:/outside') return json(400, { message });
        registered = true;
        return json(201, created);
      },
      [`GET /codebases/${created.id}/index-jobs/latest`]: noJob,
    });
    const form = screen.getByRole('form', { name: 'Register a repository' });
    const path = within(form).getByLabelText('Repository path');

    fireEvent.change(path, { target: { value: 'C:/outside' } });
    fireEvent.click(within(form).getByRole('button'));
    expect((await within(form).findByRole('alert')).textContent).toBe(message);

    fireEvent.change(path, { target: { value: ' C:/repos/app ' } });
    fireEvent.change(
      within(form).getByLabelText('Repository name (optional)'),
      {
        target: { value: created.name },
      },
    );
    fireEvent.click(within(form).getByRole('button'));

    expect(await card(created.name)).toBeTruthy();
    expect(within(form).queryByRole('alert')).toBeNull();
    expect(
      calls(fetchMock, 'POST').map(({ init }) =>
        JSON.parse(String(init?.body)),
      ),
    ).toEqual([
      { path: 'C:/outside' },
      { path: 'C:/repos/app', name: created.name },
    ]);
  });

  it('adds folder and upload collections', async () => {
    const fetchMock = await openSources({
      'POST /document-collections': (init) =>
        json(201, {
          ...documentCollectionResponseFactory.build(),
          ...JSON.parse(String(init?.body)),
        }),
    });
    const form = screen.getByRole('form', {
      name: 'Add a document collection',
    });
    const name = within(form).getByLabelText('Collection name');

    fireEvent.change(name, { target: { value: 'Specs' } });
    fireEvent.change(within(form).getByLabelText('Folder path'), {
      target: { value: 'C:/docs/specs' },
    });
    fireEvent.click(within(form).getByRole('button'));
    await vi.waitFor(() => expect((name as HTMLInputElement).value).toBe(''));

    fireEvent.change(name, { target: { value: 'Uploads' } });
    fireEvent.change(within(form).getByLabelText('Documents come from'), {
      target: { value: 'upload' },
    });
    expect(within(form).queryByLabelText('Folder path')).toBeNull();
    fireEvent.click(within(form).getByRole('button'));
    await vi.waitFor(() => expect(calls(fetchMock, 'POST')).toHaveLength(2));

    expect(
      calls(fetchMock, 'POST').map(({ init }) =>
        JSON.parse(String(init?.body)),
      ),
    ).toEqual([
      { name: 'Specs', origin: 'folder', path: 'C:/docs/specs' },
      { name: 'Uploads', origin: 'upload' },
    ]);
  });

  it('starts an index job, polls it, and reloads the sources when it ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const codebase = codebaseResponseFactory.build();
    const running = indexJobResponseFactory.build({
      sourceId: codebase.id,
      status: 'running',
      finishedAt: null,
    });
    const done = {
      ...running,
      status: 'succeeded',
      finishedAt: running.createdAt,
    };
    let started = false;
    const fetchMock = await openSources({
      'GET /codebases': () => json(200, [codebase]),
      [`POST /codebases/${codebase.id}/index`]: () => {
        started = true;
        return json(202, running);
      },
      [`GET /codebases/${codebase.id}/index-jobs/latest`]: () =>
        started ? json(200, { job: done, issues: [] }) : noJob(),
    });
    const repository = await card(codebase.name);
    await within(repository).findByText('Not indexed yet.');

    fireEvent.click(
      within(repository).getByRole('button', {
        name: `Index ${codebase.name}`,
      }),
    );
    expect(await within(repository).findByText(/Job running/)).toBeTruthy();
    expect(
      (
        within(repository).getByRole('button', {
          name: `Index ${codebase.name}`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const listsBefore = calls(fetchMock, 'GET').filter(
      ({ url }) => url === '/api/codebases',
    ).length;

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(await within(repository).findByText(/Job succeeded/)).toBeTruthy();
    await vi.waitFor(() =>
      expect(
        calls(fetchMock, 'GET').filter(({ url }) => url === '/api/codebases'),
      ).toHaveLength(listsBefore + 1),
    );
  });

  it('shows a failed job with its issues and retries it', async () => {
    const codebase = codebaseResponseFactory.build({ status: 'failed' });
    const failed = indexJobResponseFactory.build({
      sourceId: codebase.id,
      status: 'failed',
      errorSummary: faker.lorem.sentence(),
    });
    const issue = {
      relativePath: 'src/huge.ts',
      status: 'skipped' as const,
      reason: 'too-large',
    };
    const fetchMock = await openSources({
      'GET /codebases': () => json(200, [codebase]),
      [`GET /codebases/${codebase.id}/index-jobs/latest`]: latest({
        job: failed,
        issues: [issue],
      }),
      [`POST /codebases/${codebase.id}/index`]: () =>
        json(409, { message: 'A job is already active.' }),
    });
    const repository = await card(codebase.name);

    expect(
      await within(repository).findByText(String(failed.errorSummary)),
    ).toBeTruthy();
    expect(
      within(repository).getByRole('list', { name: 'Skipped or failed files' })
        .textContent,
    ).toContain('src/huge.ts: skipped (too-large)');

    fireEvent.click(within(repository).getByRole('button', { name: 'Retry' }));

    expect((await within(repository).findByRole('alert')).textContent).toBe(
      'A job is already active.',
    );
    expect(calls(fetchMock, 'POST')).toHaveLength(1);
  });

  it('syncs a collection with "Pull latest"', async () => {
    const collection = documentCollectionResponseFactory.build({
      origin: 'folder',
    });
    const fetchMock = await openSources({
      'GET /document-collections': () => json(200, [collection]),
      [`GET /document-collections/${collection.id}/index-jobs/latest`]: noJob,
      [`GET /document-collections/${collection.id}/changes`]: () =>
        json(200, { new: 0, changed: 0, removed: 0 }),
      [`POST /document-collections/${collection.id}/sync`]: () =>
        json(202, indexJobResponseFactory.build({ sourceId: collection.id })),
    });
    const folder = await card(collection.name);
    expect(within(folder).queryByText(/changes? available/)).toBeNull();

    fireEvent.click(
      within(folder).getByRole('button', { name: `Sync ${collection.name}` }),
    );

    expect(await within(folder).findByText(/Job succeeded/)).toBeTruthy();
    expect(calls(fetchMock, 'POST').map(({ url }) => url)).toEqual([
      `/api/document-collections/${collection.id}/sync`,
    ]);
  });

  describe('upload collections', () => {
    const collection: DocumentCollectionResponse =
      documentCollectionResponseFactory.build({ origin: 'upload' });
    const base = `/document-collections/${collection.id}`;
    const routes = (extra: Routes): Routes => ({
      'GET /document-collections': () => json(200, [collection]),
      [`GET ${base}/index-jobs/latest`]: noJob,
      [`GET ${base}/changes`]: () =>
        json(200, { new: 0, changed: 0, removed: 0 }),
      ...extra,
    });
    const choose = (files: File[]) =>
      fireEvent.change(
        screen.getByLabelText(`Upload files to ${collection.name}`),
        { target: { files } },
      );

    it('uploads files in path and file pairs and lists the outcome', async () => {
      const kept = documentSummaryFactory.build();
      const stored = documentSummaryFactory.build({ logicalPath: 'roles.md' });
      let uploaded = false;
      const response: UploadDocumentsResponse = {
        stored: [stored],
        unchanged: [],
        skipped: [{ logicalPath: '.env', reason: 'secret-filename' }],
        job: indexJobResponseFactory.build({ sourceId: collection.id }),
      };
      const fetchMock = await openSources(
        routes({
          [`GET ${base}/documents`]: () =>
            json(200, {
              items: uploaded ? [kept, stored] : [kept],
              nextCursor: null,
            }),
          [`POST ${base}/documents`]: () => {
            uploaded = true;
            return json(201, response);
          },
        }),
      );
      const uploads = await card(collection.name);
      await within(uploads).findByText(kept.logicalPath);

      choose([new File(['# Roles'], 'roles.md'), new File(['x'], '.env')]);

      const status = await within(uploads).findByRole('status');
      expect(status.textContent).toContain('Stored 1, unchanged 0, skipped 1.');
      expect(status.textContent).toContain('.env: looks like a secret file');
      expect(await within(uploads).findByText('roles.md')).toBeTruthy();
      const [{ init }] = calls(fetchMock, 'POST');
      const form = init?.body as FormData;
      expect(form.getAll('path')).toEqual(['roles.md', '.env']);
      expect([...form.keys()]).toEqual(['path', 'file', 'path', 'file']);
    });

    it('shows an upload rejection from the API', async () => {
      const message = faker.lorem.sentence();
      await openSources(
        routes({
          [`GET ${base}/documents`]: () =>
            json(200, { items: [], nextCursor: null }),
          [`POST ${base}/documents`]: () =>
            json(413, { statusCode: 413, message }),
        }),
      );
      const uploads = await card(collection.name);
      await within(uploads).findByText('No documents yet.');

      choose([new File(['x'], 'a.md')]);

      expect((await within(uploads).findByRole('alert')).textContent).toBe(
        message,
      );
    });

    it('pages and deletes documents after a confirmation', async () => {
      const [first, second] = documentSummaryFactory.buildList(2);
      const fetchMock = await openSources(
        routes({
          [`GET ${base}/documents`]: (_init, url) =>
            url.includes('cursor=')
              ? json(200, { items: [second], nextCursor: null })
              : json(200, { items: [first], nextCursor: 'next' }),
          [`DELETE ${base}/documents/*`]: () =>
            new Response(null, { status: 204 }),
        }),
      );
      const uploads = await card(collection.name);
      fireEvent.click(
        await within(uploads).findByRole('button', { name: 'More documents' }),
      );
      await within(uploads).findByText(second.logicalPath);

      fireEvent.click(
        within(uploads).getByRole('button', {
          name: `Delete ${first.logicalPath}`,
        }),
      );
      expect(calls(fetchMock, 'DELETE')).toEqual([]);
      fireEvent.click(
        within(uploads).getByRole('button', {
          name: `Confirm: Delete ${first.logicalPath}`,
        }),
      );

      await vi.waitFor(() =>
        expect(within(uploads).queryByText(first.logicalPath)).toBeNull(),
      );
      expect(calls(fetchMock, 'DELETE').map(({ url }) => url)).toEqual([
        `/api${base}/documents/${first.id}`,
      ]);
    });
  });

  it('deletes a source after a confirmation and clears it as the chat scope', async () => {
    const codebase = codebaseResponseFactory.build();
    let deleted = false;
    const fetchMock = mockApi({
      'GET /codebases': () => json(200, deleted ? [] : [codebase]),
      [`GET /codebases/${codebase.id}/index-jobs/latest`]: noJob,
      [`DELETE /codebases/${codebase.id}`]: () => {
        deleted = true;
        return new Response(null, { status: 204 });
      },
    });
    render(<App />);
    const select = (await screen.findByLabelText(
      'Ask about',
    )) as HTMLSelectElement;
    await screen.findByRole('option', { name: codebase.name });
    fireEvent.change(select, { target: { value: `source:${codebase.id}` } });

    fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
    const repository = await card(codebase.name);
    fireEvent.click(
      within(repository).getByRole('button', {
        name: `Delete ${codebase.name}`,
      }),
    );
    fireEvent.click(within(repository).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      within(repository).getByRole('button', {
        name: `Delete ${codebase.name}`,
      }),
    );
    fireEvent.click(
      within(repository).getByRole('button', {
        name: `Confirm: Delete ${codebase.name}`,
      }),
    );

    expect(await screen.findByText('No repositories yet.')).toBeTruthy();
    expect(calls(fetchMock, 'DELETE')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(
      ((await screen.findByLabelText('Ask about')) as HTMLSelectElement).value,
    ).toBe('');
  });
});
