import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import { InferenceRequestRejectedError } from '../../inference/errors/inference-request-rejected.error';
import { ChunkingService } from '../../ingestion/services/chunking.service';
import type { Chunk } from '../../ingestion/types/chunk';
import type {
  IncludedFile,
  SkippedEntry,
} from '../../ingestion/types/discovery-entry';
import type { FileOutcome } from '../types/file-outcome';
import type { IndexContext } from '../types/index-context';

const { codeChunks, repositoryFiles } = schema;

type ChunkInsert = typeof codeChunks.$inferInsert;
type FileValues = Omit<
  typeof repositoryFiles.$inferInsert,
  'id' | 'repositoryId' | 'relativePath'
>;

const STALE_DELETE_BATCH = 1000;

/** Writes one file's row and chunks; every query is scoped to the job's repository. */
@Injectable()
export class FileIndexerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly chunking: ChunkingService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async indexFile(
    context: IndexContext,
    file: IncludedFile,
  ): Promise<FileOutcome> {
    const [existing] = await this.database.db
      .select({
        status: repositoryFiles.status,
        contentHash: repositoryFiles.contentHash,
        embeddingModel: repositoryFiles.embeddingModel,
        chunkingVersion: repositoryFiles.chunkingVersion,
      })
      .from(repositoryFiles)
      .where(
        and(
          eq(repositoryFiles.repositoryId, context.repositoryId),
          eq(repositoryFiles.relativePath, file.relativePath),
        ),
      );
    if (
      existing?.status === 'indexed' &&
      existing.contentHash === file.contentHash &&
      existing.embeddingModel === context.embeddingModel &&
      existing.chunkingVersion === context.chunkingVersion
    ) {
      return { kind: 'unchanged' };
    }

    const chunks = this.chunking.chunk(file);
    let vectors: Map<string, number[]>;
    try {
      vectors = await this.vectorsFor(context, chunks);
    } catch (error) {
      // Rejected input (for example longer than the model context) fails this file only.
      if (!(error instanceof InferenceRequestRejectedError)) throw error;
      await this.replaceFile(context, file.relativePath, {
        ...fileMetadata(file),
        status: 'failed',
        statusReason: error.name,
      });
      return { kind: 'failed' };
    }

    await this.replaceFile(
      context,
      file.relativePath,
      {
        ...fileMetadata(file),
        status: 'indexed',
        embeddingModel: context.embeddingModel,
        chunkingVersion: context.chunkingVersion,
      },
      chunks.map((chunk) => ({
        repositoryId: context.repositoryId,
        chunkHash: chunk.chunkHash,
        symbolName: chunk.symbolName ?? null,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        embedding: vectors.get(chunk.chunkHash) as number[],
        embeddingModel: context.embeddingModel,
        chunkingVersion: context.chunkingVersion,
      })),
    );
    return { kind: 'indexed', chunksWritten: chunks.length };
  }

  async recordSkipped(
    context: IndexContext,
    entry: SkippedEntry,
  ): Promise<FileOutcome> {
    await this.replaceFile(context, entry.relativePath, {
      contentHash: null,
      language: null,
      sizeBytes: null,
      status: 'skipped',
      statusReason: entry.reason,
    });
    return { kind: 'skipped' };
  }

  /** Deletes rows for paths not seen in this run; chunks follow by cascade. */
  async removeStale(
    repositoryId: string,
    seenPaths: ReadonlySet<string>,
  ): Promise<number> {
    const rows = await this.database.db
      .select({
        id: repositoryFiles.id,
        relativePath: repositoryFiles.relativePath,
      })
      .from(repositoryFiles)
      .where(eq(repositoryFiles.repositoryId, repositoryId));
    const stale = rows
      .filter((row) => !seenPaths.has(row.relativePath))
      .map((row) => row.id);
    for (let start = 0; start < stale.length; start += STALE_DELETE_BATCH) {
      await this.database.db
        .delete(repositoryFiles)
        .where(
          and(
            eq(repositoryFiles.repositoryId, repositoryId),
            inArray(
              repositoryFiles.id,
              stale.slice(start, start + STALE_DELETE_BATCH),
            ),
          ),
        );
    }
    return stale.length;
  }

  /** Reuses vectors stored for the same chunk hash and embedding identity in this repository. */
  private async vectorsFor(
    context: IndexContext,
    chunks: readonly Chunk[],
  ): Promise<Map<string, number[]>> {
    const vectors = new Map<string, number[]>();
    const hashes = [...new Set(chunks.map((chunk) => chunk.chunkHash))];
    if (hashes.length === 0) return vectors;

    const reused = await this.database.db
      .selectDistinctOn([codeChunks.chunkHash], {
        chunkHash: codeChunks.chunkHash,
        embedding: codeChunks.embedding,
      })
      .from(codeChunks)
      .where(
        and(
          eq(codeChunks.repositoryId, context.repositoryId),
          eq(codeChunks.embeddingModel, context.embeddingModel),
          eq(codeChunks.chunkingVersion, context.chunkingVersion),
          inArray(codeChunks.chunkHash, hashes),
        ),
      );
    for (const row of reused) vectors.set(row.chunkHash, row.embedding);

    const missing = new Map<string, string>();
    for (const chunk of chunks) {
      if (!vectors.has(chunk.chunkHash)) {
        missing.set(chunk.chunkHash, chunk.content);
      }
    }
    if (missing.size === 0) return vectors;
    const embedded = await this.embeddings.embed([...missing.values()], {
      signal: context.signal,
    });
    [...missing.keys()].forEach((hash, index) =>
      vectors.set(hash, embedded[index]),
    );
    return vectors;
  }

  /** Upserts the file row and replaces its chunks in one transaction. */
  private async replaceFile(
    context: IndexContext,
    relativePath: string,
    values: FileValues,
    chunkRows: Omit<ChunkInsert, 'fileId'>[] = [],
  ): Promise<void> {
    const row = {
      embeddingModel: null,
      chunkingVersion: null,
      ...values,
      lastIndexedAt: new Date(),
    };
    await this.database.db.transaction(async (tx) => {
      const [file] = await tx
        .insert(repositoryFiles)
        .values({ repositoryId: context.repositoryId, relativePath, ...row })
        .onConflictDoUpdate({
          target: [repositoryFiles.repositoryId, repositoryFiles.relativePath],
          set: row,
        })
        .returning({ id: repositoryFiles.id });
      await tx
        .delete(codeChunks)
        .where(
          and(
            eq(codeChunks.repositoryId, context.repositoryId),
            eq(codeChunks.fileId, file.id),
          ),
        );
      if (chunkRows.length > 0) {
        await tx
          .insert(codeChunks)
          .values(chunkRows.map((chunk) => ({ ...chunk, fileId: file.id })));
      }
    });
  }
}

function fileMetadata(file: IncludedFile): FileValues {
  return {
    contentHash: file.contentHash,
    language: file.language,
    sizeBytes: file.sizeBytes,
    statusReason: null,
    status: 'indexed',
  };
}
