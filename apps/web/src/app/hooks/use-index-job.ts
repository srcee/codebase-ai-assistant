import type {
  IndexJobResponse,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, errorMessage, getJson, sendJson } from '../api/http';
import type { SourceRef } from '../types/source-ref';
import { sourcePath, startJobPath } from '../utils/source-paths';

export const POLL_INTERVAL_MS = 2000;

/** Latest job of a source; polls while it is queued or running and calls `onFinished` when it ends. */
export function useIndexJob(source: SourceRef, onFinished: () => void) {
  const [latest, setLatest] = useState<LatestIndexJobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const { kind, id } = source;

  const refresh = useCallback(async () => {
    try {
      setLatest(
        await getJson<LatestIndexJobResponse>(
          `${sourcePath({ kind, id })}/index-jobs/latest`,
        ),
      );
      setError(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setLatest(null);
      } else {
        setError(errorMessage(caught));
      }
    }
  }, [kind, id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const status = latest?.job.status;
  const active = status === 'queued' || status === 'running';

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [active, latest, refresh]);

  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !active) onFinished();
    wasActive.current = active;
  }, [active, onFinished]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const job = await sendJson<IndexJobResponse>(
        'POST',
        startJobPath({ kind, id }),
      );
      setLatest({ job, issues: [] });
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  }, [kind, id]);

  return { latest, active, starting, error, start, refresh };
}
