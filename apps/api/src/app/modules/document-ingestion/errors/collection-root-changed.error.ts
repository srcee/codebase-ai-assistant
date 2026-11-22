/** Thrown when a collection folder is unreadable or no longer resolves to the path it was registered with. */
export class CollectionRootChangedError extends Error {
  constructor() {
    super(
      'Document folder is unavailable or no longer matches the registered path.',
    );
    this.name = 'CollectionRootChangedError';
  }
}
