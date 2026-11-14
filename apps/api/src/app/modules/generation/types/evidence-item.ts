import type { ContentKind, Locator } from '@codebase-ai/contracts';

/** A retrieved chunk as the prompt sees it; numbered by its position, starting at 1. */
export interface EvidenceItem {
  sourceName: string;
  relativePath: string;
  contentKind: ContentKind;
  locator: Locator;
  content: string;
}
