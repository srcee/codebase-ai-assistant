import type { ContentKind, Locator } from '@codebase-ai/contracts';

/** What decides whether a discovered file must be indexed again. */
export interface FileFacts {
  relativePath: string;
  /** SHA-256 of the raw file bytes. */
  contentHash: string;
  sizeBytes: number;
  /** Code language or document format id. */
  language: string;
  chunkingVersion: string;
}

/** A chunk ready to embed and store, whichever chunker produced it. */
export interface IndexableChunk {
  chunkHash: string;
  title: string | null;
  contentKind: ContentKind;
  locator: Locator;
  content: string;
  searchTerms: string;
}
