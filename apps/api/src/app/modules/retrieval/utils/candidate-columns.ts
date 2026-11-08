import { schema } from '@codebase-ai/server-database';

const { codeChunks, repositories, repositoryFiles } = schema;

export const candidateColumns = {
  chunkId: codeChunks.id,
  repositoryId: codeChunks.repositoryId,
  repositoryName: repositories.name,
  relativePath: repositoryFiles.relativePath,
  startLine: codeChunks.startLine,
  endLine: codeChunks.endLine,
  symbolName: codeChunks.symbolName,
  content: codeChunks.content,
};
