import type { UploadSkipReason } from '@codebase-ai/contracts';
import { useState, type DragEvent } from 'react';
import { useCollectionDocuments } from '../hooks/use-collection-documents';
import { formatBytes } from '../utils/format-bytes';
import { ConfirmButton } from './confirm-button';

interface CollectionDocumentsProps {
  collectionId: string;
  collectionName: string;
  /** The API refuses uploads and deletes while a sync runs. */
  syncing: boolean;
  onChanged: () => void;
}

const SKIP_REASONS: Record<UploadSkipReason, string> = {
  'too-large': 'larger than the size limit',
  'unsupported-extension': 'unsupported format',
  'secret-filename': 'looks like a secret file',
};

export function CollectionDocuments({
  collectionId,
  collectionName,
  syncing,
  onChanged,
}: CollectionDocumentsProps) {
  const documents = useCollectionDocuments(collectionId, onChanged);
  const [dragging, setDragging] = useState(false);
  const uploading = documents.progress !== null;
  const blocked = syncing || uploading;

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!blocked) void documents.upload([...event.dataTransfer.files]);
  };

  return (
    <div className="documents">
      <div
        className={dragging ? 'dropzone dropzone--active' : 'dropzone'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <label>
          Drop files here or{' '}
          <input
            type="file"
            multiple
            aria-label={`Upload files to ${collectionName}`}
            disabled={blocked}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              void documents.upload(files);
            }}
          />
        </label>
        {syncing && <p className="muted">Uploads wait until the sync ends.</p>}
      </div>
      {uploading && (
        <progress
          aria-label="Upload progress"
          value={documents.progress ?? 0}
          max={1}
        />
      )}
      {documents.result && (
        <div role="status">
          <p>
            Stored {documents.result.stored.length}, unchanged{' '}
            {documents.result.unchanged.length}, skipped{' '}
            {documents.result.skipped.length}.
          </p>
          {documents.result.skipped.length > 0 && (
            <ul aria-label="Skipped uploads">
              {documents.result.skipped.map((skip) => (
                <li key={skip.logicalPath}>
                  {skip.logicalPath}: {SKIP_REASONS[skip.reason]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {documents.error && (
        <p role="alert" className="error">
          {documents.error}
        </p>
      )}
      {documents.items.length === 0 ? (
        <p className="muted">No documents yet.</p>
      ) : (
        <ul aria-label={`Documents in ${collectionName}`} className="rows">
          {documents.items.map((document) => (
            <li key={document.id}>
              <span>{document.logicalPath}</span>
              <span className="muted">{formatBytes(document.sizeBytes)}</span>
              <ConfirmButton
                label={`Delete ${document.logicalPath}`}
                disabled={blocked}
                onConfirm={() => void documents.remove(document.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {documents.hasMore && (
        <button type="button" onClick={documents.loadMore}>
          More documents
        </button>
      )}
    </div>
  );
}
