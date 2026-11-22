import type { ContentKind, Locator } from '@codebase-ai/contracts';

export interface DocumentChunk {
  /** Heading path for sections; null for text outside any heading. */
  title: string | null;
  contentKind: ContentKind;
  locator: Locator;
  content: string;
  /** SHA-256 of `content`. */
  chunkHash: string;
  /** Distinct lower-case words of the title and content, plus camelCase parts, for full-text matching. */
  searchTerms: string;
}
