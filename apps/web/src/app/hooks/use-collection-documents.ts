import type {
  DocumentSummary,
  Page,
  UploadDocumentsResponse,
} from '@codebase-ai/contracts';
import { useCallback, useEffect, useState } from 'react';
import { deleteResource, errorMessage, getJson } from '../api/http';
import { uploadDocuments } from '../api/upload-documents';

/** Documents of an upload collection, with upload and delete; `onChanged` runs after either succeeds. */
export function useCollectionDocuments(
  collectionId: string,
  onChanged: () => void,
) {
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadDocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/document-collections/${collectionId}/documents`;

  const load = useCallback(
    async (cursor?: string) => {
      try {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const page = await getJson<Page<DocumentSummary>>(`${base}${query}`);
        setItems((current) =>
          cursor ? [...current, ...page.items] : page.items,
        );
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [base],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor);
  }, [load, nextCursor]);

  const upload = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      setProgress(0);
      setResult(null);
      try {
        setResult(await uploadDocuments(collectionId, files, setProgress));
        setError(null);
        await load();
        onChanged();
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setProgress(null);
      }
    },
    [collectionId, load, onChanged],
  );

  const remove = useCallback(
    async (documentId: string) => {
      try {
        await deleteResource(`${base}/${documentId}`);
        setItems((current) => current.filter((item) => item.id !== documentId));
        setError(null);
        onChanged();
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [base, onChanged],
  );

  return {
    items,
    hasMore: nextCursor !== null,
    progress,
    result,
    error,
    loadMore,
    upload,
    remove,
  };
}
