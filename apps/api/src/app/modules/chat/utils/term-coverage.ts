import { searchTermsFor } from '../../ingestion/utils/identifier-terms';
import type { SearchCandidate } from '../../retrieval/types/search-candidate';

/** Share of the query terms found in the chunk's title, path, or content, from 0 to 1. */
export function termCoverage(
  queryTerms: readonly string[],
  chunk: Pick<SearchCandidate, 'title' | 'relativePath' | 'content'>,
): number {
  if (queryTerms.length === 0) return 0;
  const present = new Set(
    searchTermsFor(
      `${chunk.title ?? ''}\n${chunk.relativePath}\n${chunk.content}`,
    ).split(' '),
  );
  return (
    queryTerms.filter((term) => present.has(term)).length / queryTerms.length
  );
}
