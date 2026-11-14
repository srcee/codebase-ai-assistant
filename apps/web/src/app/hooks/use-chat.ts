import type {
  Citation,
  ConversationResponse,
  MessageResponse,
  MessageStatus,
} from '@codebase-ai/contracts';
import { useCallback, useRef, useState } from 'react';
import { streamChat } from '../api/chat-stream';
import { errorMessage, getJson } from '../api/http';
import type { ChatScope } from '../types/chat-scope';

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state: MessageStatus | 'streaming' | 'stopped' | 'failed';
  citations: Citation[];
  invalidCitations: number[];
  suggestions: string[];
}

const MAX_HISTORY_PAGES = 10;

let localIds = 0;
const localId = (): string => `local-${++localIds}`;

const fromResponse = (message: MessageResponse): ChatItem => ({
  id: message.id,
  role: message.role,
  content: message.content,
  state: message.status,
  citations: message.citations,
  invalidCitations: [],
  suggestions: [],
});

export function useChat(onAnswered: () => void) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const update = (id: string, change: (item: ChatItem) => ChatItem) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? change(item) : item)),
    );

  const send = useCallback(
    async (question: string, scope: ChatScope) => {
      const controller = new AbortController();
      abort.current = controller;
      const answerId = localId();
      setError(null);
      setBusy(true);
      setItems((current) => [
        ...current,
        {
          id: localId(),
          role: 'user',
          content: question,
          state: 'complete',
          citations: [],
          invalidCitations: [],
          suggestions: [],
        },
        {
          id: answerId,
          role: 'assistant',
          content: '',
          state: 'streaming',
          citations: [],
          invalidCitations: [],
          suggestions: [],
        },
      ]);

      try {
        await streamChat(
          {
            question,
            ...(scope.kind === 'project'
              ? { projectId: scope.id }
              : { sourceIds: [scope.id] }),
            ...(conversationId ? { conversationId } : {}),
          },
          controller.signal,
          (event) => {
            if (event.event === 'meta') {
              setConversationId(event.data.conversationId);
            } else if (event.event === 'token') {
              update(answerId, (item) => ({
                ...item,
                content: item.content + event.data.text,
              }));
            } else if (event.event === 'done') {
              update(answerId, (item) => ({
                ...item,
                content: event.data.answer,
                state: event.data.status,
                citations: event.data.citations,
                invalidCitations: event.data.invalidCitations,
                suggestions: event.data.suggestions,
              }));
              onAnswered();
            } else {
              update(answerId, (item) => ({ ...item, state: 'failed' }));
              setError(event.data.message);
            }
          },
        );
      } catch (caught) {
        const stopped = controller.signal.aborted;
        update(answerId, (item) => ({
          ...item,
          state: stopped ? 'stopped' : 'failed',
        }));
        if (!stopped) setError(errorMessage(caught));
      } finally {
        abort.current = null;
        setBusy(false);
      }
    },
    [conversationId, onAnswered],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setItems([]);
    setConversationId(null);
    setError(null);
  }, []);

  const open = useCallback(async (id: string) => {
    abort.current?.abort();
    setError(null);
    try {
      const loaded: MessageResponse[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
        const query = new URLSearchParams({ limit: '100' });
        if (cursor) query.set('cursor', cursor);
        const conversation: ConversationResponse = await getJson(
          `/conversations/${id}?${query.toString()}`,
        );
        loaded.push(...conversation.messages.items);
        cursor = conversation.messages.nextCursor;
        if (!cursor) break;
      }
      setItems(loaded.map(fromResponse));
      setConversationId(id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  return { items, conversationId, busy, error, send, stop, reset, open };
}
