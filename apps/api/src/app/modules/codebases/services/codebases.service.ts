import { basename } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  CreateCodebaseRequest,
  CodebaseResponse,
} from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { PathRejectedError } from '../errors/path-rejected.error';
import { toCodebaseResponse } from '../mappers/to-codebase-response';
import { relativeToAnyRoot } from '../utils/relative-within';
import { PathPolicyService } from './path-policy.service';

const { sources } = schema;

const isCodebase = eq(sources.kind, 'code_repository');
const codebaseWithId = (id: string) => and(eq(sources.id, id), isCodebase);

@Injectable()
export class CodebasesService {
  private readonly logger = new Logger(CodebasesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly pathPolicy: PathPolicyService,
  ) {}

  async register(request: CreateCodebaseRequest): Promise<CodebaseResponse> {
    const resolved = await this.pathPolicy
      .resolve(request.path)
      .catch((error) => {
        if (error instanceof PathRejectedError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      });

    const [row] = await this.database.db
      .insert(sources)
      .values({
        name: request.name ?? (basename(resolved.canonicalPath) || 'codebase'),
        kind: 'code_repository',
        canonicalPath: resolved.canonicalPath,
      })
      .onConflictDoNothing({ target: sources.canonicalPath })
      .returning();
    if (!row) throw new ConflictException('Codebase is already registered.');
    this.logger.log(`Codebase registered id=${row.id}`);
    return toCodebaseResponse(row, resolved.relativePath);
  }

  async list(): Promise<CodebaseResponse[]> {
    const [rows, roots] = await Promise.all([
      this.database.db
        .select()
        .from(sources)
        .where(isCodebase)
        .orderBy(asc(sources.name), asc(sources.createdAt)),
      this.pathPolicy.canonicalRoots(),
    ]);
    return rows.map((row) =>
      toCodebaseResponse(row, relativeToAnyRoot(roots, row.canonicalPath)),
    );
  }

  async get(id: string): Promise<CodebaseResponse> {
    const [row] = await this.database.db
      .select()
      .from(sources)
      .where(codebaseWithId(id));
    if (!row) throw new NotFoundException('Codebase not found.');
    const roots = await this.pathPolicy.canonicalRoots();
    return toCodebaseResponse(row, relativeToAnyRoot(roots, row.canonicalPath));
  }

  /** Foreign keys cascade the delete to files, chunks, jobs, and project links. */
  async remove(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(sources)
      .where(codebaseWithId(id))
      .returning({ id: sources.id });
    if (deleted.length === 0)
      throw new NotFoundException('Codebase not found.');
    this.logger.log(`Codebase deleted id=${id}`);
  }
}
