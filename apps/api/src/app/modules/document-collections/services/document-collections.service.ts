import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { DocumentCollectionResponse } from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { PathRejectedError } from '../../codebases/errors/path-rejected.error';
import { PathPolicyService } from '../../codebases/services/path-policy.service';
import { relativeToAnyRoot } from '../../codebases/utils/relative-within';
import { BlobStoreService } from '../../document-ingestion/services/blob-store.service';
import { toDocumentCollectionResponse } from '../mappers/to-document-collection-response';

const { sources } = schema;

const isCollection = eq(sources.kind, 'document_collection');
const collectionWithId = (id: string) => and(eq(sources.id, id), isCollection);

const NOT_FOUND = 'Document collection not found.';

@Injectable()
export class DocumentCollectionsService {
  private readonly logger = new Logger(DocumentCollectionsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly pathPolicy: PathPolicyService,
    private readonly blobs: BlobStoreService,
  ) {}

  /** The folder must sit inside ALLOWED_DOCUMENT_ROOTS; it is mirrored, never copied. */
  async registerFolder(
    name: string,
    path: string,
  ): Promise<DocumentCollectionResponse> {
    const resolved = await this.pathPolicy
      .resolve(path, 'document_collection')
      .catch((error) => {
        if (error instanceof PathRejectedError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      });

    const [row] = await this.database.db
      .insert(sources)
      .values({
        name,
        kind: 'document_collection',
        origin: 'folder',
        canonicalPath: resolved.canonicalPath,
      })
      .onConflictDoNothing({ target: sources.canonicalPath })
      .returning();
    if (!row) {
      throw new ConflictException('This folder is already registered.');
    }
    this.logger.log(`Document collection registered id=${row.id}`);
    return toDocumentCollectionResponse(row, resolved.relativePath);
  }

  /** Documents are added later through the upload endpoint; their originals live in DATA_DIR. */
  async registerUpload(name: string): Promise<DocumentCollectionResponse> {
    const [row] = await this.database.db
      .insert(sources)
      .values({ name, kind: 'document_collection', origin: 'upload' })
      .returning();
    this.logger.log(`Upload collection registered id=${row.id}`);
    return toDocumentCollectionResponse(row, null);
  }

  async list(): Promise<DocumentCollectionResponse[]> {
    const [rows, roots] = await Promise.all([
      this.database.db
        .select()
        .from(sources)
        .where(isCollection)
        .orderBy(asc(sources.name), asc(sources.createdAt)),
      this.pathPolicy.canonicalRoots('document_collection'),
    ]);
    return rows.map((row) =>
      toDocumentCollectionResponse(
        row,
        relativeToAnyRoot(roots, row.canonicalPath),
      ),
    );
  }

  async get(id: string): Promise<DocumentCollectionResponse> {
    const [row] = await this.database.db
      .select()
      .from(sources)
      .where(collectionWithId(id));
    if (!row) throw new NotFoundException(NOT_FOUND);
    const roots = await this.pathPolicy.canonicalRoots('document_collection');
    return toDocumentCollectionResponse(
      row,
      relativeToAnyRoot(roots, row.canonicalPath),
    );
  }

  /** Foreign keys cascade the delete to files, chunks, documents, jobs, and project links; a running sync stops before its next file. */
  async remove(id: string): Promise<void> {
    const [deleted] = await this.database.db
      .delete(sources)
      .where(collectionWithId(id))
      .returning({ origin: sources.origin });
    if (!deleted) throw new NotFoundException(NOT_FOUND);
    this.logger.log(`Document collection deleted id=${id}`);
    if (deleted.origin === 'upload') await this.blobs.sweepQuietly();
  }
}
