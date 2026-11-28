import type { SourceRef } from '../types/source-ref';

export const sourcePath = (source: SourceRef): string =>
  source.kind === 'codebase'
    ? `/codebases/${source.id}`
    : `/document-collections/${source.id}`;

/** Codebases are indexed, collections are synced ("Pull latest"). */
export const startJobPath = (source: SourceRef): string =>
  `${sourcePath(source)}/${source.kind === 'codebase' ? 'index' : 'sync'}`;
