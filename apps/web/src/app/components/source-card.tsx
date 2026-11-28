import type { DocumentOrigin, SourceStatus } from '@codebase-ai/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCloudUpload,
  IconFolder,
  IconGitBranch,
  IconRefresh,
} from '@tabler/icons-react';
import { useState } from 'react';
import { deleteResource, errorMessage } from '../api/http';
import { useIndexJob } from '../hooks/use-index-job';
import type { SourceRef } from '../types/source-ref';
import { sourcePath } from '../utils/source-paths';
import { ChangesBadge } from './changes-badge';
import { CollectionDocuments } from './collection-documents';
import { ConfirmButton } from './confirm-button';
import { IndexJobStatus } from './index-job-status';
import classes from './source-card.module.css';

// Undefined uses the theme accent.
const STATUS_COLORS: Record<SourceStatus, string | undefined> = {
  registered: 'gray',
  indexing: undefined,
  ready: 'green',
  failed: 'red',
};

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
  const Icon =
    source.kind === 'codebase'
      ? IconGitBranch
      : origin === 'upload'
        ? IconCloudUpload
        : IconFolder;
  return (
    <Card component="li" withBorder padding="md" aria-label={name}>
      <Group justify="space-between" align="flex-start" gap="sm">
        <Group gap="sm" wrap="nowrap" className={classes.identity}>
          <ThemeIcon size="lg" variant="light" aria-hidden>
            <Icon size={20} stroke={1.6} />
          </ThemeIcon>
          <Stack gap={2} className={classes.identity}>
            <Group gap="xs">
              <Text fw={600}>{name}</Text>
              <Badge
                variant="light"
                color={STATUS_COLORS[status]}
                leftSection={
                  status === 'indexing' ? <Loader size={10} /> : undefined
                }
              >
                {status}
              </Badge>
              {source.kind === 'collection' && (
                <ChangesBadge
                  collectionId={source.id}
                  refreshKey={job.latest?.job.finishedAt ?? null}
                />
              )}
            </Group>
            <Text size="xs" c="dimmed" ff="monospace" truncate>
              {origin === 'upload'
                ? 'Uploaded files'
                : (relativePath ?? 'Folder outside the allowed roots')}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="light"
            size="xs"
            aria-label={`${action} ${name}`}
            disabled={busy}
            loading={busy}
            leftSection={<IconRefresh size={14} />}
            onClick={() => void job.start()}
          >
            {action}
          </Button>
          <ConfirmButton
            label={`Delete ${name}`}
            disabled={job.starting}
            onConfirm={() => void remove()}
          />
        </Group>
      </Group>
      <Card.Section withBorder inheritPadding py="sm" mt="md">
        <IndexJobStatus
          latest={job.latest}
          retrying={busy}
          onRetry={() => void job.start()}
        />
        {shownError && (
          <Alert role="alert" color="red" mt="sm" icon={<IconAlertCircle />}>
            {shownError}
          </Alert>
        )}
      </Card.Section>
      {origin === 'upload' && (
        <Card.Section withBorder inheritPadding py="sm">
          <CollectionDocuments
            collectionId={source.id}
            collectionName={name}
            syncing={job.active}
            onChanged={() => void job.refresh()}
          />
        </Card.Section>
      )}
    </Card>
  );
}
