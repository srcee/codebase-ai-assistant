import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { CollectionRootChangedError } from '../../document-ingestion/errors/collection-root-changed.error';
import { ParseCancelledError } from '../../document-ingestion/errors/parse-cancelled.error';
import { InferenceUnavailableError } from '../../inference/errors/inference-unavailable.error';
import { RepositoryRootChangedError } from '../../ingestion/errors/repository-root-changed.error';
import { summarizeIndexError } from './summarize-index-error';

describe('summarizeIndexError', () => {
  it.each([
    new InferenceUnavailableError('timeout'),
    new RepositoryRootChangedError(),
    new CollectionRootChangedError(),
    new ParseCancelledError(),
  ])('keeps the message of a sanitized error', (error) => {
    expect(summarizeIndexError(error)).toBe(error.message);
  });

  it('keeps only the class name of any other error', () => {
    const error = new TypeError(`bad input ${CANARY_SECRET}`);
    expect(summarizeIndexError(error)).toBe('Indexing failed: TypeError');
  });

  it('handles non-errors', () => {
    expect(summarizeIndexError(CANARY_SECRET)).toBe(
      'Indexing failed: UnknownError',
    );
  });
});
