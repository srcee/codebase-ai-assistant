import type { PathRejectionReason } from './path-rejection-reason';

// A missing path and one outside the roots share a message so callers cannot probe the filesystem.
const ROOT_OR_MISSING =
  'Path must be an existing directory inside an allowed repository root.';

const PUBLIC_MESSAGES: Record<PathRejectionReason, string> = {
  'invalid-path':
    'Path must be an absolute local path without traversal segments.',
  'not-found': ROOT_OR_MISSING,
  'outside-allowed-roots': ROOT_OR_MISSING,
  'not-a-directory': 'Path must be a directory.',
  'not-a-git-repository': 'Directory must contain a .git directory.',
};

/** The message never includes the rejected path. */
export class PathRejectedError extends Error {
  constructor(readonly reason: PathRejectionReason) {
    super(PUBLIC_MESSAGES[reason]);
    this.name = 'PathRejectedError';
  }
}
