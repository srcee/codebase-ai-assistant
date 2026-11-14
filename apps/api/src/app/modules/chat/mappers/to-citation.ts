import type { Citation } from '@codebase-ai/contracts';
import type { RetrievedChunk } from '../../retrieval/types/retrieved-chunk';

export function toCitation(chunk: RetrievedChunk, ordinal: number): Citation {
  return {
    ordinal,
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    sourceName: chunk.sourceName,
    relativePath: chunk.relativePath,
    contentKind: chunk.contentKind,
    locator: chunk.locator,
  };
}
