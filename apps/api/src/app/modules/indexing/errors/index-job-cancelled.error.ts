/** Stops a job whose source was deleted or whose process is shutting down. */
export class IndexJobCancelledError extends Error {
  constructor() {
    super('Index job was cancelled.');
    this.name = 'IndexJobCancelledError';
  }
}
