import type { RetrievedChunk } from '../types/retrieved-chunk';
import type {
  RetrievalSource,
  SearchCandidate,
} from '../types/search-candidate';

/** Merges two ranked lists by summing 1 / (k + rank); ties go to the better single rank, then the chunk id. */
export function reciprocalRankFusion(
  vectorResults: readonly SearchCandidate[],
  lexicalResults: readonly SearchCandidate[],
  k: number,
): RetrievedChunk[] {
  const fused = new Map<string, RetrievedChunk>();

  const add = (
    results: readonly SearchCandidate[],
    source: RetrievalSource,
  ): void => {
    results.forEach((candidate, index) => {
      const rank = index + 1;
      const entry: RetrievedChunk = fused.get(candidate.chunkId) ?? {
        ...candidate,
        score: 0,
        sources: [],
      };
      entry.score += 1 / (k + rank);
      entry.sources.push(source);
      entry[source === 'vector' ? 'vectorRank' : 'lexicalRank'] = rank;
      fused.set(candidate.chunkId, entry);
    });
  };

  add(vectorResults, 'vector');
  add(lexicalResults, 'lexical');

  const bestRank = (chunk: RetrievedChunk): number =>
    Math.min(
      chunk.vectorRank ?? Number.POSITIVE_INFINITY,
      chunk.lexicalRank ?? Number.POSITIVE_INFINITY,
    );

  return [...fused.values()].sort(
    (a, b) =>
      b.score - a.score ||
      bestRank(a) - bestRank(b) ||
      a.chunkId.localeCompare(b.chunkId),
  );
}
