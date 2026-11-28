import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type {
  DocumentSummary,
  Page,
  PageQuery,
  UploadDocumentsResponse,
} from '@codebase-ai/contracts';
import {
  DatabaseService,
  type DatabaseTransaction,
  schema,
} from '@codebase-ai/server-database';
import { DEFAULT_PAGE_SIZE } from '../../chat/dto/page-query.dto';
import { BlobStoreService } from '../../document-ingestion/services/blob-store.service';
import { IndexJobRunnerService } from '../../indexing/services/index-job-runner.service';
import { toDocumentSummary } from '../mappers/to-document-summary';
import type { ReceivedPart } from '../types/received-part';
import type { UploadRequest } from '../types/upload-request';
import { decodePathCursor, encodePathCursor } from '../utils/path-cursor';
import { UploadReceiverService } from './upload-receiver.service';

const { documents, indexJobs, sourceFiles, sources } = schema;

type DocumentRow = typeof documents.$inferSelect;
type Received = Extract<ReceivedPart, { kind: 'received' }>;

interface SaveOutcome {
  stored: DocumentRow[];
  unchanged: DocumentRow[];
  /** An existing path got new content, so its old blob may be unreferenced. */
  replacedContent: boolean;
}

const COLLECTION_NOT_FOUND = 'Document collection not found.';
const NOT_UPLOAD = 'Only upload collections accept and delete documents.';
const SYNC_ACTIVE =
  'A sync job is running for this document collection; try again when it finishes.';

/** Adds, replaces, and deletes the documents of upload collections; a change starts a sync job. */
@Injectable()
export class DocumentUploadsService {
  private readonly logger = new Logger(DocumentUploadsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly receiver: UploadReceiverService,
    private readonly blobs: BlobStoreService,
    private readonly runner: IndexJobRunnerService,
  ) {}

  /** Ordered by path ignoring case, like the unique index. */
  async list(
    collectionId: string,
    query: PageQuery,
  ): Promise<Page<DocumentSummary>> {
    const [collection] = await this.database.db
      .select({ origin: sources.origin })
      .from(sources)
      .where(
        and(
          eq(sources.id, collectionId),
          eq(sources.kind, 'document_collection'),
        ),
      );
    if (!collection) throw new NotFoundException(COLLECTION_NOT_FOUND);
    if (collection.origin !== 'upload') {
      throw new BadRequestException(NOT_UPLOAD);
    }

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after =
      query.cursor === undefined ? undefined : decodePathCursor(query.cursor);
    const lowerPath = sql<string>`lower(${documents.logicalPath})`;
    const rows = await this.database.db
      .select({ row: documents, lowerPath })
      .from(documents)
      .where(
        and(
          eq(documents.sourceId, collectionId),
          after === undefined ? undefined : sql`${lowerPath} > ${after}`,
        ),
      )
      .orderBy(asc(lowerPath))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: items.map(({ row }) => toDocumentSummary(row)),
      nextCursor:
        rows.length > limit && last ? encodePathCursor(last.lowerPath) : null,
    };
  }

  async upload(
    collectionId: string,
    request: UploadRequest,
  ): Promise<UploadDocumentsResponse> {
    // Fails fast before the body is read; checked again under the row lock below.
    await this.database.db.transaction((tx) =>
      this.lockUploadCollection(tx, collectionId),
    );
    const parts = await this.receiver.receive(request);
    const received = parts.filter(
      (part): part is Received => part.kind === 'received',
    );

    let saved: SaveOutcome;
    try {
      saved = await this.database.db.transaction(async (tx) => {
        await this.lockUploadCollection(tx, collectionId);
        return this.save(tx, collectionId, received);
      });
    } catch (error) {
      await this.receiver.discard(received);
      throw error;
    }
    if (saved.replacedContent) await this.blobs.sweepQuietly();

    const job =
      saved.stored.length > 0
        ? (await this.runner.trySync(collectionId)).job
        : null;
    const skipped = parts.flatMap((part) =>
      part.kind === 'skipped'
        ? [{ logicalPath: part.logicalPath, reason: part.reason }]
        : [],
    );
    this.logger.log(
      `Upload collection=${collectionId} stored=${saved.stored.length} unchanged=${saved.unchanged.length} skipped=${skipped.length}`,
    );
    return {
      stored: saved.stored.map(toDocumentSummary),
      unchanged: saved.unchanged.map(toDocumentSummary),
      skipped,
      job,
    };
  }

  /** Removes the document, its chunks, and, once unreferenced, its original. */
  async remove(collectionId: string, documentId: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await this.lockUploadCollection(tx, collectionId);
      const [deleted] = await tx
        .delete(documents)
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.sourceId, collectionId),
          ),
        )
        .returning({ logicalPath: documents.logicalPath });
      if (!deleted) throw new NotFoundException('Document not found.');
      await tx
        .delete(sourceFiles)
        .where(
          and(
            eq(sourceFiles.sourceId, collectionId),
            eq(sourceFiles.relativePath, deleted.logicalPath),
          ),
        );
    });
    this.logger.log(
      `Document deleted collection=${collectionId} id=${documentId}`,
    );
    await this.blobs.sweepQuietly();
  }

  private async save(
    tx: DatabaseTransaction,
    collectionId: string,
    received: readonly Received[],
  ): Promise<SaveOutcome> {
    const stored: DocumentRow[] = [];
    const unchanged: DocumentRow[] = [];
    let replacedContent = false;
    for (const part of received) {
      const [existing] = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.sourceId, collectionId),
            sql`lower(${documents.logicalPath}) = lower(${part.logicalPath})`,
          ),
        );
      if (
        existing?.blobHash === part.blob.hash &&
        existing.logicalPath === part.logicalPath
      ) {
        await this.blobs.discard(part.blob);
        unchanged.push(existing);
        continue;
      }
      await this.blobs.store(tx, part.blob);
      const values = {
        logicalPath: part.logicalPath,
        blobHash: part.blob.hash,
        sizeBytes: part.blob.sizeBytes,
        mediaType: part.mediaType,
      };
      const [row] = existing
        ? await tx
            .update(documents)
            .set(values)
            .where(eq(documents.id, existing.id))
            .returning()
        : await tx
            .insert(documents)
            .values({ sourceId: collectionId, ...values })
            .returning();
      if (existing && existing.blobHash !== part.blob.hash) {
        replacedContent = true;
      }
      stored.push(row);
    }
    return { stored, unchanged, replacedContent };
  }

  // The row lock orders this against job creation, which also writes the source row.
  private async lockUploadCollection(
    tx: DatabaseTransaction,
    collectionId: string,
  ): Promise<void> {
    const [collection] = await tx
      .select({ origin: sources.origin })
      .from(sources)
      .where(
        and(
          eq(sources.id, collectionId),
          eq(sources.kind, 'document_collection'),
        ),
      )
      .for('update');
    if (!collection) throw new NotFoundException(COLLECTION_NOT_FOUND);
    if (collection.origin !== 'upload') {
      throw new BadRequestException(NOT_UPLOAD);
    }
    const [active] = await tx
      .select({ id: indexJobs.id })
      .from(indexJobs)
      .where(
        and(
          eq(indexJobs.sourceId, collectionId),
          inArray(indexJobs.status, ['queued', 'running']),
        ),
      )
      .limit(1);
    if (active) throw new ConflictException(SYNC_ACTIVE);
  }
}
