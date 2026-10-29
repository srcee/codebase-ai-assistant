export type FileOutcome =
  | { kind: 'indexed'; chunksWritten: number }
  | { kind: 'unchanged' }
  | { kind: 'skipped' }
  | { kind: 'failed' };
