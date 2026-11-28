import type { UploadSkipReason } from '@codebase-ai/contracts';
import {
  Alert,
  Button,
  Group,
  List,
  Progress,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCloudUpload,
  IconFileText,
} from '@tabler/icons-react';
import { useState, type DragEvent } from 'react';
import { useCollectionDocuments } from '../hooks/use-collection-documents';
import { formatBytes } from '../utils/format-bytes';
import classes from './collection-documents.module.css';
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
    <Stack gap="sm">
      <div
        className={classes.dropzone}
        data-active={dragging || undefined}
        data-disabled={blocked || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <IconCloudUpload
          size={28}
          stroke={1.5}
          className={classes.dropIcon}
          aria-hidden
        />
        <label className={classes.dropLabel}>
          <Text size="sm" span>
            Drop files here or <span className={classes.browse}>browse</span>
          </Text>
          <input
            type="file"
            multiple
            className={classes.fileInput}
            aria-label={`Upload files to ${collectionName}`}
            disabled={blocked}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              void documents.upload(files);
            }}
          />
        </label>
        {syncing && (
          <Text size="xs" c="dimmed">
            Uploads wait until the sync ends.
          </Text>
        )}
      </div>
      {uploading && (
        <Progress
          aria-label="Upload progress"
          value={(documents.progress ?? 0) * 100}
          animated
        />
      )}
      {documents.result && (
        <Alert role="status" color="green" icon={<IconCircleCheck />} p="sm">
          <Text size="sm">
            Stored {documents.result.stored.length}, unchanged{' '}
            {documents.result.unchanged.length}, skipped{' '}
            {documents.result.skipped.length}.
          </Text>
          {documents.result.skipped.length > 0 && (
            <List size="xs" mt={4} aria-label="Skipped uploads">
              {documents.result.skipped.map((skip) => (
                <List.Item key={skip.logicalPath}>
                  {skip.logicalPath}: {SKIP_REASONS[skip.reason]}
                </List.Item>
              ))}
            </List>
          )}
        </Alert>
      )}
      {documents.error && (
        <Alert role="alert" color="red" icon={<IconAlertCircle />} p="sm">
          {documents.error}
        </Alert>
      )}
      {documents.items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No documents yet.
        </Text>
      ) : (
        <ul
          aria-label={`Documents in ${collectionName}`}
          className={classes.rows}
        >
          {documents.items.map((document) => (
            <li key={document.id} className={classes.row}>
              <IconFileText size={16} stroke={1.6} aria-hidden />
              <Text size="sm" ff="monospace" className={classes.path}>
                {document.logicalPath}
              </Text>
              <Text size="xs" c="dimmed">
                {formatBytes(document.sizeBytes)}
              </Text>
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
        <Group>
          <Button variant="subtle" size="xs" onClick={documents.loadMore}>
            More documents
          </Button>
        </Group>
      )}
    </Stack>
  );
}
