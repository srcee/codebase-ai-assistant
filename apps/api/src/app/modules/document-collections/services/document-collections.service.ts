import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  CreateDocumentCollectionRequest,
  DocumentCollectionResponse,
} from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { PathRejectedError } from '../../codebases/errors/path-rejected.error';
import { PathPolicyService } from '../../codebases/services/path-policy.service';
import { relativeToAnyRoot } from '../../codebases/utils/relative-within';
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
  ) {}

  /** The folder must sit inside ALLOWED_DOCUMENT_ROOTS; it is mirrored, never copied. */
  async register(
    request: CreateDocumentCollectionRequest,
  ): Promise<DocumentCollectionResponse> {
    const resolved = await this.pathPolicy
      .resolve(request.path, 'document_collection')
      .catch((error) => {
        if (error instanceof PathRejectedError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      });

    const [row] = await this.database.db
      .insert(sources)
      .values({
        name: request.name,
        kind: 'document_collection',
        origin: request.origin,
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

  /** Foreign keys cascade the delete to files, chunks, jobs, and project links; a running sync stops before its next file. */
  async remove(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(sources)
      .where(collectionWithId(id))
      .returning({ id: sources.id });
    if (deleted.length === 0) throw new NotFoundException(NOT_FOUND);
    this.logger.log(`Document collection deleted id=${id}`);
  }
}
