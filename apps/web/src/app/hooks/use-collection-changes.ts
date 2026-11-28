import type { DocumentChangesResponse } from '@codebase-ai/contracts';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage, getJson } from '../api/http';

/** What a sync of the collection would change, without parsing anything; reloads when `refreshKey` changes. */
export function useCollectionChanges(
  collectionId: string,
  refreshKey: string | null,
) {
  const [changes, setChanges] = useState<DocumentChangesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setChanges(
        await getJson<DocumentChangesResponse>(
          `/document-collections/${collectionId}/changes`,
        ),
      );
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [collectionId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const pending = changes ? changes.new + changes.changed + changes.removed : 0;
  return { pending, error };
}
