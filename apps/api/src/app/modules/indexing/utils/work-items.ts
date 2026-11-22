import type { SkippedEntry } from '../../ingestion/types/discovery-entry';
import type { FileOutcome } from '../types/file-outcome';

/** One discovered path and the work that records it, whatever kind of source it came from. */
export interface WorkItem {
  relativePath: string;
  /** Excluded directories are not walked, so they get no file row. */
  isDirectory: boolean;
  process: () => Promise<FileOutcome>;
}

export async function* workItems<
  T extends { status: 'included'; relativePath: string },
>(
  entries: AsyncIterable<T | SkippedEntry>,
  index: (file: T) => Promise<FileOutcome>,
  recordSkipped: (entry: SkippedEntry) => Promise<FileOutcome>,
): AsyncGenerator<WorkItem> {
  for await (const entry of entries) {
    if (entry.status === 'skipped') {
      const skipped = entry as SkippedEntry;
      yield {
        relativePath: skipped.relativePath,
        isDirectory: skipped.kind === 'directory',
        process: () => recordSkipped(skipped),
      };
    } else {
      const file = entry as T;
      yield {
        relativePath: file.relativePath,
        isDirectory: false,
        process: () => index(file),
      };
    }
  }
}
