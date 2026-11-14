import type { ConversationSummary, Page } from '@codebase-ai/contracts';
import { useCallback, useEffect, useState } from 'react';
import { deleteResource, errorMessage, getJson } from '../api/http';

export function useConversations() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const page: Page<ConversationSummary> = await getJson(
        `/conversations${query}`,
      );
      setItems((current) =>
        cursor ? [...current, ...page.items] : page.items,
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => void load(), [load]);
  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor);
  }, [load, nextCursor]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteResource(`/conversations/${id}`);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  return {
    items,
    hasMore: nextCursor !== null,
    error,
    refresh,
    loadMore,
    remove,
  };
}
