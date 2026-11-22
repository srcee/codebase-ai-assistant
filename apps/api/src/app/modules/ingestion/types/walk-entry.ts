import type { SkippedEntry } from './discovery-entry';

/** A regular file that passed the exclusion rules; the caller decides whether to read it. */
export interface FoundFile {
  status: 'found';
  /** Forward-slash path relative to the walked root. */
  relativePath: string;
  absolutePath: string;
}

export type WalkEntry = FoundFile | SkippedEntry;
