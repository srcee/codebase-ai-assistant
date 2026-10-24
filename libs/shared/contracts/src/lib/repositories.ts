export type RepositoryStatus = 'registered' | 'indexing' | 'ready' | 'failed';

export interface CreateRepositoryRequest {
  /** Absolute path of a directory inside one of the allowed repository roots. */
  path: string;
  /** Defaults to the directory name. */
  name?: string;
}

export interface RepositoryResponse {
  id: string;
  name: string;
  /** Forward-slash path relative to its allowed root; null if no configured root contains it any more. */
  relativePath: string | null;
  status: RepositoryStatus;
  lastIndexedCommit: string | null;
  createdAt: string;
  updatedAt: string;
}
