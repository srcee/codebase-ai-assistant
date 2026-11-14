import type { SearchResult } from '@codebase-ai/contracts';
import type { RetrievedChunk } from '../types/retrieved-chunk';

export function toSearchResult(chunk: RetrievedChunk): SearchResult {
  return {
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    sourceName: chunk.sourceName,
    sourceKind: chunk.sourceKind,
    relativePath: chunk.relativePath,
    title: chunk.title,
    contentKind: chunk.contentKind,
    locator: chunk.locator,
    content: chunk.content,
    score: chunk.score,
    sources: chunk.sources,
    vectorRank: chunk.vectorRank ?? null,
    lexicalRank: chunk.lexicalRank ?? null,
  };
}
