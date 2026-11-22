import type { SkippedEntry } from '../../ingestion/types/discovery-entry';
import type { DocumentFormat } from './document-format';

export interface DocumentFile {
  status: 'included';
  /** Forward-slash path relative to the collection root. */
  relativePath: string;
  format: DocumentFormat;
  sizeBytes: number;
  /** SHA-256 of the raw bytes. */
  contentHash: string;
  /** The raw bytes; they may be transferred to a parse worker, so load them once per parse. */
  load: () => Promise<Uint8Array>;
}

export type DocumentEntry = DocumentFile | SkippedEntry;
