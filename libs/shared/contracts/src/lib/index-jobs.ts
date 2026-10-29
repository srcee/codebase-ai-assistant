export type IndexJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface IndexJobResponse {
  id: string;
  codebaseId: string;
  status: IndexJobStatus;
  filesDiscovered: number;
  filesIndexed: number;
  filesSkipped: number;
  filesFailed: number;
  chunksWritten: number;
  /** Sanitized; never contains file contents or paths outside the repository. */
  errorSummary: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface IndexedFileIssue {
  relativePath: string;
  status: 'skipped' | 'failed';
  /** A skip reason id or a failure kind; never file contents. */
  reason: string | null;
}

export interface LatestIndexJobResponse {
  job: IndexJobResponse;
  /** Skipped and failed files from the latest run, capped. */
  issues: IndexedFileIssue[];
}
