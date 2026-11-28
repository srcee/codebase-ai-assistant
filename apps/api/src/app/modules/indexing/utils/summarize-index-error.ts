import { PathRejectedError } from '../../codebases/errors/path-rejected.error';
import { BlobMissingError } from '../../document-ingestion/errors/blob-missing.error';
import { CollectionRootChangedError } from '../../document-ingestion/errors/collection-root-changed.error';
import { ParseCancelledError } from '../../document-ingestion/errors/parse-cancelled.error';
import { EmbeddingDimensionMismatchError } from '../../embeddings/errors/embedding-dimension-mismatch.error';
import { InferenceModelNotFoundError } from '../../inference/errors/inference-model-not-found.error';
import { InferenceRequestRejectedError } from '../../inference/errors/inference-request-rejected.error';
import { InferenceUnavailableError } from '../../inference/errors/inference-unavailable.error';
import { RepositoryRootChangedError } from '../../ingestion/errors/repository-root-changed.error';

// Messages of these classes carry reason codes only, never paths, payloads or source.
const SAFE_MESSAGE_ERRORS = [
  InferenceUnavailableError,
  InferenceModelNotFoundError,
  InferenceRequestRejectedError,
  EmbeddingDimensionMismatchError,
  RepositoryRootChangedError,
  CollectionRootChangedError,
  BlobMissingError,
  ParseCancelledError,
  PathRejectedError,
];

export function summarizeIndexError(error: unknown): string {
  if (SAFE_MESSAGE_ERRORS.some((type) => error instanceof type)) {
    return (error as Error).message;
  }
  const name = error instanceof Error ? error.name : 'UnknownError';
  return `Indexing failed: ${name}`;
}
