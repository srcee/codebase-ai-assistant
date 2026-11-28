/** Thrown when a document row points at a blob that is gone from DATA_DIR or no longer matches its hash. */
export class BlobMissingError extends Error {
  constructor() {
    super(
      'An uploaded document is missing or damaged in the local blob store.',
    );
    this.name = 'BlobMissingError';
  }
}
