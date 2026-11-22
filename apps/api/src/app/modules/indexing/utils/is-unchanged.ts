/** The stored state of a file row that the unchanged check compares. */
export interface StoredFileIdentity {
  status: string;
  contentHash: string | null;
  embeddingModel: string | null;
  chunkingVersion: string | null;
}

/**
 * A file is unchanged when its hash and index identity match a row that was indexed, or skipped for its
 * content after hashing. Rows skipped before hashing carry no hash, so they are always checked again.
 */
export function isUnchanged(
  stored: StoredFileIdentity | undefined,
  current: {
    contentHash: string;
    embeddingModel: string;
    chunkingVersion: string;
  },
): boolean {
  return (
    stored !== undefined &&
    (stored.status === 'indexed' || stored.status === 'skipped') &&
    stored.contentHash === current.contentHash &&
    stored.embeddingModel === current.embeddingModel &&
    stored.chunkingVersion === current.chunkingVersion
  );
}
