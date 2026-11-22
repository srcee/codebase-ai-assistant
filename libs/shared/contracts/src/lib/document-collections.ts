import type { SourceStatus } from './locators';

export type DocumentOrigin = 'folder' | 'upload';

export interface CreateDocumentCollectionRequest {
  name: string;
  origin: 'folder';
  /** Absolute path of a directory inside one of the allowed document roots. */
  path: string;
}

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
