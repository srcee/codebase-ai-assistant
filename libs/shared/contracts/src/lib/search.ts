export interface SearchRequest {
  query: string;
  repositoryIds: string[];
}

export type SearchSource = 'vector' | 'lexical';

export interface SearchResult {
  chunkId: string;
  repositoryId: string;
  repositoryName: string;
  relativePath: string;
  /** 1-based, inclusive. */
  startLine: number;
  /** 1-based, inclusive. */
  endLine: number;
  symbolName: string | null;
  content: string;
  /** Fused rank score; only comparable within one response. */
  score: number;
  sources: SearchSource[];
  /** 1-based position in each search, null when that search did not find the chunk. */
  vectorRank: number | null;
  lexicalRank: number | null;
}

export interface SearchResponse {
  results: SearchResult[];
}
