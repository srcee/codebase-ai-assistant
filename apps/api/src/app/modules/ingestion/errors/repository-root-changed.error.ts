/** Thrown when the repository root is unreadable or no longer resolves to the path it was registered with. */
export class RepositoryRootChangedError extends Error {
  constructor() {
    super(
      'Repository root is unavailable or no longer matches the registered path.',
    );
    this.name = 'RepositoryRootChangedError';
  }
}
