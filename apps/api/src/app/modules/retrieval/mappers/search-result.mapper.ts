import type { SearchResult } from '@codebase-ai/contracts';
import type { RetrievedChunk } from '../types/retrieved-chunk';

export function toSearchResult(chunk: RetrievedChunk): SearchResult {
  return {
    chunkId: chunk.chunkId,
    repositoryId: chunk.repositoryId,
    repositoryName: chunk.repositoryName,
    relativePath: chunk.relativePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    symbolName: chunk.symbolName,
    content: chunk.content,
    score: chunk.score,
    sources: chunk.sources,
    vectorRank: chunk.vectorRank ?? null,
    lexicalRank: chunk.lexicalRank ?? null,
  };
}
