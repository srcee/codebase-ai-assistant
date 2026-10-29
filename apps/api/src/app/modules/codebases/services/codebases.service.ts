import { basename } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type {
  CreateCodebaseRequest,
  CodebaseResponse,
} from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { PathRejectedError } from '../errors/path-rejected.error';
import { toCodebaseResponse } from '../mappers/to-codebase-response';
import { relativeToAnyRoot } from '../utils/relative-within';
import { PathPolicyService } from './path-policy.service';

const { repositories } = schema;

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
      .insert(repositories)
      .values({
        name: request.name ?? (basename(resolved.canonicalPath) || 'codebase'),
        canonicalPath: resolved.canonicalPath,
      })
      .onConflictDoNothing({ target: repositories.canonicalPath })
      .returning();
    if (!row) throw new ConflictException('Codebase is already registered.');
    this.logger.log(`Codebase registered id=${row.id}`);
    return toCodebaseResponse(row, resolved.relativePath);
  }

  async list(): Promise<CodebaseResponse[]> {
    const [rows, roots] = await Promise.all([
      this.database.db
        .select()
        .from(repositories)
        .orderBy(asc(repositories.name), asc(repositories.createdAt)),
      this.pathPolicy.canonicalRoots(),
    ]);
    return rows.map((row) =>
      toCodebaseResponse(row, relativeToAnyRoot(roots, row.canonicalPath)),
    );
  }

  async get(id: string): Promise<CodebaseResponse> {
    const [row] = await this.database.db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id));
    if (!row) throw new NotFoundException('Codebase not found.');
    const roots = await this.pathPolicy.canonicalRoots();
    return toCodebaseResponse(row, relativeToAnyRoot(roots, row.canonicalPath));
  }

  /** Foreign keys cascade the delete to files, chunks, and jobs. */
  async remove(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(repositories)
      .where(eq(repositories.id, id))
      .returning({ id: repositories.id });
    if (deleted.length === 0)
      throw new NotFoundException('Codebase not found.');
    this.logger.log(`Codebase deleted id=${id}`);
  }
}
