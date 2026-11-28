import type { IndexJobResponse } from './index-jobs';
import type { SourceStatus } from './locators';

export type DocumentOrigin = 'folder' | 'upload';

export interface CreateFolderCollectionRequest {
  name: string;
  origin: 'folder';
  /** Absolute path of a directory inside one of the allowed document roots. */
  path: string;
}

export interface CreateUploadCollectionRequest {
  name: string;
  origin: 'upload';
}

export type CreateDocumentCollectionRequest =
  | CreateFolderCollectionRequest
  | CreateUploadCollectionRequest;

export interface DocumentCollectionResponse {
  id: string;
  name: string;
  origin: DocumentOrigin;
  /** Forward-slash path relative to its allowed document root; null if no configured root contains it any more. */
  relativePath: string | null;
  status: SourceStatus;
  createdAt: string;
  updatedAt: string;
}

/** What a sync would change, found by hashing files without parsing or embedding them. */
export interface DocumentChangesResponse {
  new: number;
  changed: number;
  /** Indexed files that are gone or now excluded. */
  removed: number;
}

export interface DocumentSummary {
  id: string;
  /** Forward-slash path inside the collection, as given at upload. */
  logicalPath: string;
  sizeBytes: number;
  mediaType: string;
  updatedAt: string;
}

export type UploadSkipReason =
  | 'too-large'
  | 'unsupported-extension'
  | 'secret-filename';

export interface SkippedUpload {
  logicalPath: string;
  reason: UploadSkipReason;
}

export interface UploadDocumentsResponse {
  /** New documents and documents whose content changed. */
  stored: DocumentSummary[];
  /** Same path and same content as before; nothing is re-indexed. */
  unchanged: DocumentSummary[];
  skipped: SkippedUpload[];
  /** The index job for the stored documents; null when nothing was stored. */
  job: IndexJobResponse | null;
}
