import type { ContentKind, Locator, SourceKind } from '@codebase-ai/contracts';

export type RetrievalSource = 'vector' | 'lexical';

export interface SearchCandidate {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  sourceKind: SourceKind;
  relativePath: string;
  title: string | null;
  contentKind: ContentKind;
  locator: Locator;
  content: string;
}
