import type { ChatRequest } from '@codebase-ai/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  chatDoneEventFactory,
  codebaseResponseFactory,
  conversationResponseFactory,
  conversationSummaryFactory,
  faker,
  healthResponseFactory,
  projectResponseFactory,
} from '@codebase-ai/shared-testing';
import { eventStream, json, mockApi } from '../testing/mock-api';
import App from './app';

const project = projectResponseFactory.build();
const codebase = codebaseResponseFactory.build();
const scopes = {
  'GET /projects': () => json(200, [project]),
  'GET /codebases': () => json(200, [codebase]),
};

const chooseScope = async (value: string) => {
  const select = await screen.findByLabelText('Ask about');
  await screen.findByRole('option', { name: project.name });
  fireEvent.change(select, { target: { value } });
};

const ask = (question: string) => {
  const input = screen.getByLabelText('Question');
  fireEvent.change(input, { target: { value: question } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

const chatBodies = (fetchMock: ReturnType<typeof mockApi>): ChatRequest[] =>
  fetchMock.mock.calls
    .filter(([url]) => url === '/api/chat')
    .map(([, init]) => JSON.parse(String(init?.body)) as ChatRequest);

describe('App', () => {
  describe('health', () => {
    it('shows ok when the API is healthy', async () => {
      const health = healthResponseFactory.build();
      mockApi({ 'GET /health': () => json(200, health) });
      render(<App />);
      expect(
        await screen.findByText(`API status: ${health.status}`),
      ).toBeTruthy();
    });

    it('shows degraded with the failing dependency', async () => {
      const health = healthResponseFactory.degraded().build();
      mockApi({ 'GET /health': () => json(503, health) });
      render(<App />);
      expect(await screen.findByText('API status: degraded')).toBeTruthy();
      expect(screen.getByText('The database is not reachable.')).toBeTruthy();
    });

    it('names a missing model', async () => {
      const health = healthResponseFactory.build();
      health.inference.chatModel.available = false;
      mockApi({ 'GET /health': () => json(200, health) });
      render(<App />);
      expect(
        await screen.findByText(
          `Model ${health.inference.chatModel.name} is not installed.`,
        ),
      ).toBeTruthy();
    });

    it('shows unreachable when the API fails', async () => {
      mockApi({});
      vi.mocked(fetch).mockRejectedValueOnce(new Error(faker.lorem.sentence()));
      render(<App />);
      expect(await screen.findByText('API status: unreachable')).toBeTruthy();
    });
  });

  describe('chat', () => {
    it('disables sending until a scope is chosen', async () => {
      mockApi(scopes);
      render(<App />);
      fireEvent.change(screen.getByLabelText('Question'), {
        target: { value: 'Where is it?' },
      });
      expect(
        (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    it('streams an answer, then shows the final text and citations', async () => {
      const done = chatDoneEventFactory.build({ invalidCitations: [4] });
      const conversationId = faker.string.uuid();
      const fetchMock = mockApi({
        ...scopes,
        'POST /chat': () =>
          eventStream([
            { event: 'meta', data: { conversationId } },
            { event: 'token', data: { text: 'Partial' } },
            { event: 'done', data: done },
          ]),
      });
      render(<App />);
      await chooseScope(`project:${project.id}`);

      ask('How are retries handled?');

      expect(await screen.findByText(done.answer)).toBeTruthy();
      const citations = screen.getByRole('list', { name: 'Citations' });
      const [citation] = done.citations;
      expect(within(citations).getByText(`[${citation.ordinal}]`)).toBeTruthy();
      expect(citations.textContent).toContain(citation.relativePath);
      expect(
        screen.getByText(/Removed 1 citation that did not match/),
      ).toBeTruthy();
      expect(chatBodies(fetchMock)).toEqual([
        { question: 'How are retries handled?', projectId: project.id },
      ]);
    });

    it('sends a repository scope and continues the conversation', async () => {
      const conversationId = faker.string.uuid();
      const fetchMock = mockApi({
        ...scopes,
        'POST /chat': () =>
          eventStream([
            { event: 'meta', data: { conversationId } },
            { event: 'done', data: chatDoneEventFactory.build() },
          ]),
      });
      render(<App />);
      await chooseScope(`source:${codebase.id}`);

      ask('First?');
      await screen.findByRole('list', { name: 'Citations' });
      ask('Second?');
      await vi.waitFor(() => expect(chatBodies(fetchMock)).toHaveLength(2));

      const [first, second] = chatBodies(fetchMock);
      expect(first).toEqual({ question: 'First?', sourceIds: [codebase.id] });
      expect(second).toMatchObject({ question: 'Second?', conversationId });
    });

    it('shows an abstention with suggestions', async () => {
      const done = chatDoneEventFactory.build({
        status: 'abstained',
        citations: [],
        suggestions: [faker.lorem.sentence()],
      });
      mockApi({
        ...scopes,
        'POST /chat': () => eventStream([{ event: 'done', data: done }]),
      });
      render(<App />);
      await chooseScope(`project:${project.id}`);

      ask('Unknown topic?');

      const suggestions = await screen.findByRole('list', {
        name: 'Suggestions',
      });
      expect(suggestions.textContent).toContain(done.suggestions[0]);
      expect(screen.queryByRole('list', { name: 'Citations' })).toBeNull();
    });

    it('explains an unavailable inference runtime', async () => {
      const message = faker.lorem.sentence();
      mockApi({
        ...scopes,
        'POST /chat': () => json(503, { statusCode: 503, message }),
      });
      render(<App />);
      await chooseScope(`project:${project.id}`);

      ask('Anything?');

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(message);
      expect(alert.textContent).toContain('local inference runtime');
    });

    it('shows a stream error event', async () => {
      const message = faker.lorem.sentence();
      mockApi({
        ...scopes,
        'POST /chat': () =>
          eventStream([{ event: 'error', data: { message } }]),
      });
      render(<App />);
      await chooseScope(`project:${project.id}`);

      ask('Anything?');

      expect((await screen.findByRole('alert')).textContent).toBe(message);
    });

    it('stops a streaming answer', async () => {
      mockApi({
        ...scopes,
        'POST /chat': (init) =>
          eventStream(
            [{ event: 'token', data: { text: 'Working' } }],
            init?.signal ?? undefined,
          ),
      });
      render(<App />);
      await chooseScope(`project:${project.id}`);

      ask('Long question?');
      fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

      expect(await screen.findByText('Stopped.')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    });
  });

  describe('conversations', () => {
    it('opens a stored conversation with its citations', async () => {
      const conversation = conversationResponseFactory.build({
        projectId: project.id,
      });
      const summary = conversationSummaryFactory.build({
        id: conversation.id,
        title: conversation.title,
      });
      mockApi({
        ...scopes,
        'GET /conversations': () =>
          json(200, { items: [summary], nextCursor: null }),
        'GET /conversations/*': () => json(200, conversation),
      });
      render(<App />);

      fireEvent.click(
        await screen.findByRole('button', { name: summary.title }),
      );

      const [, answer] = conversation.messages.items;
      expect(await screen.findByText(answer.content)).toBeTruthy();
      expect(
        screen.getByRole('list', { name: 'Citations' }).textContent,
      ).toContain(answer.citations[0].relativePath);
    });

    it('loads more and deletes a conversation', async () => {
      const [first, second] = conversationSummaryFactory.buildList(2);
      const fetchMock = mockApi({
        'GET /conversations': (_init, url) =>
          url.includes('cursor=')
            ? json(200, { items: [second], nextCursor: null })
            : json(200, { items: [first], nextCursor: 'next' }),
        'DELETE /conversations/*': () => new Response(null, { status: 204 }),
      });
      render(<App />);

      fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
      expect(
        await screen.findByRole('button', { name: second.title }),
      ).toBeTruthy();

      fireEvent.click(
        screen.getByRole('button', { name: `Delete ${first.title}` }),
      );

      await vi.waitFor(() =>
        expect(screen.queryByRole('button', { name: first.title })).toBeNull(),
      );
      expect(fetchMock).toHaveBeenCalledWith(`/api/conversations/${first.id}`, {
        method: 'DELETE',
      });
    });
  });
});
