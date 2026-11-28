import type { LatestIndexJobResponse } from '@codebase-ai/contracts';

interface IndexJobStatusProps {
  latest: LatestIndexJobResponse | null;
  /** Shown as "Retry" on a failed job. */
  onRetry: () => void;
  retrying: boolean;
}

export function IndexJobStatus({
  latest,
  onRetry,
  retrying,
}: IndexJobStatusProps) {
  if (!latest) return <p className="muted">Not indexed yet.</p>;
  const { job, issues } = latest;
  return (
    <div className="job" aria-label="Latest job">
      <p>
        Job {job.status}: {job.filesIndexed} of {job.filesDiscovered} files
        indexed, {job.filesSkipped} skipped, {job.filesFailed} failed,{' '}
        {job.chunksWritten} chunks.
      </p>
      {job.errorSummary && <p className="error">{job.errorSummary}</p>}
      {job.status === 'failed' && (
        <button type="button" onClick={onRetry} disabled={retrying}>
          Retry
        </button>
      )}
      {issues.length > 0 && (
        <details>
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
    </div>
  );
}
