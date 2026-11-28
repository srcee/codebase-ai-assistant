import type { DocumentOrigin, SourceStatus } from '@codebase-ai/contracts';
import { useState } from 'react';
import { deleteResource, errorMessage } from '../api/http';
import { useIndexJob } from '../hooks/use-index-job';
import type { SourceRef } from '../types/source-ref';
import { sourcePath } from '../utils/source-paths';
import { ChangesBadge } from './changes-badge';
import { CollectionDocuments } from './collection-documents';
import { ConfirmButton } from './confirm-button';
import { IndexJobStatus } from './index-job-status';

interface SourceCardProps {
  source: SourceRef;
  name: string;
  /** Path relative to its allowed root; null for uploads or a root that is gone. */
  relativePath: string | null;
  status: SourceStatus;
  origin?: DocumentOrigin;
  onChanged: () => void;
  onDeleted: (id: string) => void;
}

export function SourceCard({
  source,
  name,
  relativePath,
  status,
  origin,
  onChanged,
  onDeleted,
}: SourceCardProps) {
  const job = useIndexJob(source, onChanged);
  const [error, setError] = useState<string | null>(null);
  const action = source.kind === 'codebase' ? 'Index' : 'Sync';
  const busy = job.active || job.starting;

  const remove = async () => {
    try {
      await deleteResource(sourcePath(source));
      onDeleted(source.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const shownError = error ?? job.error;
  return (
    <li className="source" aria-label={name}>
      <div className="source__header">
        <strong>{name}</strong>
        <span className="muted">
          {origin === 'upload'
            ? 'Uploaded files'
            : (relativePath ?? 'Folder outside the allowed roots')}
        </span>
        <span className={`badge badge--${status}`}>{status}</span>
        {source.kind === 'collection' && (
          <ChangesBadge
            collectionId={source.id}
            refreshKey={job.latest?.job.finishedAt ?? null}
          />
        )}
        <span className="source__actions">
          <button
            type="button"
            aria-label={`${action} ${name}`}
            disabled={busy}
            onClick={() => void job.start()}
          >
            {action}
          </button>
          <ConfirmButton
            label={`Delete ${name}`}
            disabled={job.starting}
            onConfirm={() => void remove()}
          />
        </span>
      </div>
      <IndexJobStatus
        latest={job.latest}
        retrying={busy}
        onRetry={() => void job.start()}
      />
      {shownError && (
        <p role="alert" className="error">
          {shownError}
        </p>
      )}
      {origin === 'upload' && (
        <CollectionDocuments
          collectionId={source.id}
          collectionName={name}
          syncing={job.active}
          onChanged={() => void job.refresh()}
        />
      )}
    </li>
  );
}
