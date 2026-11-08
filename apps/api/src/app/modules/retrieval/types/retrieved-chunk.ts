import type { RetrievalSource, SearchCandidate } from './search-candidate';

export interface RetrievedChunk extends SearchCandidate {
  /** Fused rank score; only comparable within one result set. */
  score: number;
  sources: RetrievalSource[];
  /** 1-based position in each search, when that search found the chunk. */
  vectorRank?: number;
  lexicalRank?: number;
}
