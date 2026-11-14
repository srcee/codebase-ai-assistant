import { schema } from '@codebase-ai/server-database';

const { chunks, sources, sourceFiles } = schema;

export const candidateColumns = {
  chunkId: chunks.id,
  sourceId: chunks.sourceId,
  sourceName: sources.name,
  sourceKind: sources.kind,
  relativePath: sourceFiles.relativePath,
  title: chunks.title,
  contentKind: chunks.contentKind,
  locator: chunks.locator,
  content: chunks.content,
};
