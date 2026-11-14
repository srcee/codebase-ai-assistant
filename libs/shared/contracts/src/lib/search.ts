import type { ContentKind, Locator, SourceKind } from './locators';

/** Send exactly one of `sourceIds` or `projectId`. */
export interface SearchRequest {
  query: string;
  sourceIds?: string[];
  projectId?: string;
}

export type SearchSource = 'vector' | 'lexical';

export interface SearchResult {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  sourceKind: SourceKind;
  relativePath: string;
  title: string | null;
  contentKind: ContentKind;
  locator: Locator;
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
