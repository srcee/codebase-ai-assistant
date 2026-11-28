import type {
  IndexJobStatus as JobStatus,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { Button, Group, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconCircleCheck,
  IconClock,
  IconLoader2,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import classes from './index-job-status.module.css';

interface IndexJobStatusProps {
  latest: LatestIndexJobResponse | null;
  /** Shown as "Retry" on a failed job. */
  onRetry: () => void;
  retrying: boolean;
}

// Undefined uses the theme accent.
const JOB_STYLES: Record<
  JobStatus,
  { color: string | undefined; Icon: typeof IconClock }
> = {
  queued: { color: 'gray', Icon: IconClock },
  running: { color: undefined, Icon: IconLoader2 },
  succeeded: { color: 'green', Icon: IconCircleCheck },
  failed: { color: 'red', Icon: IconX },
};

export function IndexJobStatus({
  latest,
  onRetry,
  retrying,
}: IndexJobStatusProps) {
  if (!latest)
    return (
      <Text size="sm" c="dimmed">
        Not indexed yet.
      </Text>
    );
  const { job, issues } = latest;
  const { color, Icon } = JOB_STYLES[job.status];
  const active = job.status === 'queued' || job.status === 'running';
  return (
    <Stack gap="xs" aria-label="Latest job">
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <ThemeIcon size="sm" variant="light" color={color} aria-hidden>
          <Icon size={14} />
        </ThemeIcon>
        <Text size="sm">
          Job {job.status}: {job.filesIndexed} of {job.filesDiscovered} files
          indexed, {job.filesSkipped} skipped, {job.filesFailed} failed,{' '}
          {job.chunksWritten} chunks.
        </Text>
      </Group>
      {active && job.filesDiscovered > 0 && (
        <Progress
          size="sm"
          animated
          value={(job.filesIndexed / job.filesDiscovered) * 100}
          aria-label="Indexing progress"
        />
      )}
      {job.errorSummary && (
        <Text size="sm" c="red">
          {job.errorSummary}
        </Text>
      )}
      {job.status === 'failed' && (
        <Group>
          <Button
            variant="light"
            color="red"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={onRetry}
            disabled={retrying}
          >
            Retry
          </Button>
        </Group>
      )}
      {issues.length > 0 && (
        <details className={classes.issues}>
          <summary>{issues.length} skipped or failed files</summary>
          <ul aria-label="Skipped or failed files">
            {issues.map((issue) => (
              <li key={issue.relativePath}>
                {issue.relativePath}: {issue.status}
                {issue.reason && ` (${issue.reason})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Stack>
  );
}
