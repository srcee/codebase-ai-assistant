import type { Language } from './language';
import type { SkipReason } from './skip-reason';

export interface SkippedEntry {
  status: 'skipped';
  /** Forward-slash path relative to the repository root. */
  relativePath: string;
  kind: 'file' | 'directory' | 'symlink';
  reason: SkipReason;
}

export interface IncludedFile {
  status: 'included';
  relativePath: string;
  language: Language;
  sizeBytes: number;
  /** SHA-256 of the raw file bytes. */
  contentHash: string;
  /** Decoded as UTF-8, BOM removed and line endings normalized to LF. */
  text: string;
}

export type DiscoveryEntry = SkippedEntry | IncludedFile;
