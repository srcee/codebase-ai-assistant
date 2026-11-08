export type RetrievalSource = 'vector' | 'lexical';

export interface SearchCandidate {
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
}
