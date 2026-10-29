export class IndexJobCancelledError extends Error {
  constructor() {
    super('Index job was cancelled because the codebase was deleted.');
    this.name = 'IndexJobCancelledError';
  }
}
