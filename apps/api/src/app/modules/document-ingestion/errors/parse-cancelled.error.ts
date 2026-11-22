/** Thrown for a parse that was aborted or outlived the pool; the job is cancelled instead of the file failing. */
export class ParseCancelledError extends Error {
  constructor() {
    super('Parsing was cancelled.');
    this.name = 'ParseCancelledError';
  }
}
