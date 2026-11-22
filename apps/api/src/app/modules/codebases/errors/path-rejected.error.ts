import type { SourceKind } from '@codebase-ai/contracts';
import type { PathRejectionReason } from '../types/path-rejection-reason';

const ROOT_NAMES: Record<SourceKind, string> = {
  code_repository: 'repository',
  document_collection: 'document',
};

function publicMessage(reason: PathRejectionReason, kind: SourceKind): string {
  switch (reason) {
    case 'invalid-path':
      return 'Path must be an absolute local path without traversal segments.';
    // A missing path and one outside the roots share a message so callers cannot probe the filesystem.
    case 'not-found':
    case 'outside-allowed-roots':
      return `Path must be an existing directory inside an allowed ${ROOT_NAMES[kind]} root.`;
    case 'not-a-directory':
      return 'Path must be a directory.';
    case 'not-a-git-repository':
      return 'Directory must contain a .git directory.';
  }
}

/** The message never includes the rejected path. */
export class PathRejectedError extends Error {
  constructor(
    readonly reason: PathRejectionReason,
    kind: SourceKind = 'code_repository',
  ) {
    super(publicMessage(reason, kind));
    this.name = 'PathRejectedError';
  }
}
