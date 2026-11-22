import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { EmbeddingsService } from '../../embeddings/services/embeddings.service';
import { InferenceRequestRejectedError } from '../../inference/errors/inference-request-rejected.error';
import { CHUNKING_VERSION } from '../../ingestion/constants/chunking-version';
import { ChunkingService } from '../../ingestion/services/chunking.service';
import type {
  IncludedFile,
  SkippedEntry,
} from '../../ingestion/types/discovery-entry';
import type { SkipReason } from '../../ingestion/types/skip-reason';
import type { FileFacts, IndexableChunk } from '../types/file-facts';
import type { FileOutcome } from '../types/file-outcome';
import type { IndexContext } from '../types/index-context';
import { isUnchanged } from '../utils/is-unchanged';

const { chunks: chunkTable, sourceFiles } = schema;

type ChunkInsert = typeof chunkTable.$inferInsert;
type FileValues = Omit<
  typeof sourceFiles.$inferInsert,
  'id' | 'sourceId' | 'relativePath'
>;

const STALE_DELETE_BATCH = 1000;

/** Writes one file's row and chunks; every query is scoped to the job's source. */
@Injectable()
export class FileIndexerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly chunking: ChunkingService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Indexes a code file; an unchanged file is not chunked again. */
  async indexFile(
    context: IndexContext,
    file: IncludedFile,
  ): Promise<FileOutcome> {
    const facts: FileFacts = {
      relativePath: file.relativePath,
      contentHash: file.contentHash,
      sizeBytes: file.sizeBytes,
      language: file.language,
      chunkingVersion: CHUNKING_VERSION,
    };
    if (await this.isUnchanged(context, facts)) return { kind: 'unchanged' };
    return this.storeChunks(
      context,
      facts,
      this.chunking.chunk(file).map((chunk) => ({
        chunkHash: chunk.chunkHash,
        title: chunk.symbolName ?? null,
        contentKind: 'code',
        locator: {
          kind: 'lines',
          startLine: chunk.startLine,
          endLine: chunk.endLine,
        },
        content: chunk.content,
        searchTerms: chunk.searchTerms,
      })),
    );
  }

  async isUnchanged(context: IndexContext, file: FileFacts): Promise<boolean> {
    const [stored] = await this.database.db
      .select({
        status: sourceFiles.status,
        contentHash: sourceFiles.contentHash,
        embeddingModel: sourceFiles.embeddingModel,
        chunkingVersion: sourceFiles.chunkingVersion,
      })
      .from(sourceFiles)
      .where(
        and(
          eq(sourceFiles.sourceId, context.sourceId),
          eq(sourceFiles.relativePath, file.relativePath),
        ),
      );
    return isUnchanged(stored, {
      contentHash: file.contentHash,
      embeddingModel: context.embeddingModel,
      chunkingVersion: file.chunkingVersion,
    });
  }

  /** Embeds the chunks, reusing stored vectors, and replaces the file's chunks. */
  async storeChunks(
    context: IndexContext,
    file: FileFacts,
    chunks: readonly IndexableChunk[],
  ): Promise<FileOutcome> {
    let vectors: Map<string, number[]>;
    try {
      vectors = await this.vectorsFor(context, file, chunks);
    } catch (error) {
      // Rejected input (for example longer than the model context) fails this file only.
      if (!(error instanceof InferenceRequestRejectedError)) throw error;
      return this.storeFailure(context, file, error.name);
    }

    await this.replaceFile(
      context,
      file.relativePath,
      {
        ...fileMetadata(file),
        status: 'indexed',
        embeddingModel: context.embeddingModel,
        chunkingVersion: file.chunkingVersion,
      },
      chunks.map((chunk) => ({
        sourceId: context.sourceId,
        chunkHash: chunk.chunkHash,
        title: chunk.title,
        contentKind: chunk.contentKind,
        locator: chunk.locator,
        startLine:
          chunk.locator.kind === 'lines' ? chunk.locator.startLine : null,
        endLine: chunk.locator.kind === 'lines' ? chunk.locator.endLine : null,
        content: chunk.content,
        searchTerms: chunk.searchTerms,
        embedding: vectors.get(chunk.chunkHash) as number[],
        embeddingModel: context.embeddingModel,
        chunkingVersion: file.chunkingVersion,
      })),
    );
    return { kind: 'indexed', chunksWritten: chunks.length };
  }

  /** A failed file is tried again on the next run. */
  async storeFailure(
    context: IndexContext,
    file: FileFacts,
    reason: string,
  ): Promise<FileOutcome> {
    await this.replaceFile(context, file.relativePath, {
      ...fileMetadata(file),
      status: 'failed',
      statusReason: reason,
    });
    return { kind: 'failed' };
  }

  /** A file skipped for its content keeps its hash and identity, so it is not parsed again while unchanged. */
  async storeContentSkip(
    context: IndexContext,
    file: FileFacts,
    reason: SkipReason,
  ): Promise<FileOutcome> {
    await this.replaceFile(context, file.relativePath, {
      ...fileMetadata(file),
      status: 'skipped',
      statusReason: reason,
      embeddingModel: context.embeddingModel,
      chunkingVersion: file.chunkingVersion,
    });
    return { kind: 'skipped' };
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
    sourceId: string,
    seenPaths: ReadonlySet<string>,
  ): Promise<number> {
    const rows = await this.database.db
      .select({
        id: sourceFiles.id,
        relativePath: sourceFiles.relativePath,
      })
      .from(sourceFiles)
      .where(eq(sourceFiles.sourceId, sourceId));
    const stale = rows
      .filter((row) => !seenPaths.has(row.relativePath))
      .map((row) => row.id);
    for (let start = 0; start < stale.length; start += STALE_DELETE_BATCH) {
      await this.database.db
        .delete(sourceFiles)
        .where(
          and(
            eq(sourceFiles.sourceId, sourceId),
            inArray(
              sourceFiles.id,
              stale.slice(start, start + STALE_DELETE_BATCH),
            ),
          ),
        );
    }
    return stale.length;
  }

  /** Reuses vectors stored for the same chunk hash and embedding identity in this source. */
  private async vectorsFor(
    context: IndexContext,
    file: FileFacts,
    chunks: readonly IndexableChunk[],
  ): Promise<Map<string, number[]>> {
    const vectors = new Map<string, number[]>();
    const hashes = [...new Set(chunks.map((chunk) => chunk.chunkHash))];
    if (hashes.length === 0) return vectors;

    const reused = await this.database.db
      .selectDistinctOn([chunkTable.chunkHash], {
        chunkHash: chunkTable.chunkHash,
        embedding: chunkTable.embedding,
      })
      .from(chunkTable)
      .where(
        and(
          eq(chunkTable.sourceId, context.sourceId),
          eq(chunkTable.embeddingModel, context.embeddingModel),
          eq(chunkTable.chunkingVersion, file.chunkingVersion),
          inArray(chunkTable.chunkHash, hashes),
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
    const embedded = await this.embeddings.embedDocuments(
      [...missing.values()],
      {
        signal: context.signal,
      },
    );
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
        .insert(sourceFiles)
        .values({ sourceId: context.sourceId, relativePath, ...row })
        .onConflictDoUpdate({
          target: [sourceFiles.sourceId, sourceFiles.relativePath],
          set: row,
        })
        .returning({ id: sourceFiles.id });
      await tx
        .delete(chunkTable)
        .where(
          and(
            eq(chunkTable.sourceId, context.sourceId),
            eq(chunkTable.fileId, file.id),
          ),
        );
      if (chunkRows.length > 0) {
        await tx
          .insert(chunkTable)
          .values(chunkRows.map((chunk) => ({ ...chunk, fileId: file.id })));
      }
    });
  }
}

function fileMetadata(file: FileFacts): FileValues {
  return {
    contentHash: file.contentHash,
    language: file.language,
    sizeBytes: file.sizeBytes,
    statusReason: null,
    status: 'indexed',
  };
}
