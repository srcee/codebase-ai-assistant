import { basename } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type {
  CreateRepositoryRequest,
  RepositoryResponse,
} from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import { PathPolicyService } from './path-policy/path-policy.service';
import { PathRejectedError } from './path-policy/path-rejected.error';
import { relativeToAnyRoot } from './path-policy/relative-within';
import { toRepositoryResponse } from './to-repository-response';

const { repositories } = schema;

@Injectable()
export class RepositoriesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly pathPolicy: PathPolicyService,
  ) {}

  async register(
    request: CreateRepositoryRequest,
  ): Promise<RepositoryResponse> {
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
        name:
          request.name ?? (basename(resolved.canonicalPath) || 'repository'),
        canonicalPath: resolved.canonicalPath,
      })
      .onConflictDoNothing({ target: repositories.canonicalPath })
      .returning();
    if (!row) throw new ConflictException('Repository is already registered.');
    return toRepositoryResponse(row, resolved.relativePath);
  }

  async list(): Promise<RepositoryResponse[]> {
    const [rows, roots] = await Promise.all([
      this.database.db
        .select()
        .from(repositories)
        .orderBy(asc(repositories.name), asc(repositories.createdAt)),
      this.pathPolicy.canonicalRoots(),
    ]);
    return rows.map((row) =>
      toRepositoryResponse(row, relativeToAnyRoot(roots, row.canonicalPath)),
    );
  }

  async get(id: string): Promise<RepositoryResponse> {
    const [row] = await this.database.db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id));
    if (!row) throw new NotFoundException('Repository not found.');
    const roots = await this.pathPolicy.canonicalRoots();
    return toRepositoryResponse(
      row,
      relativeToAnyRoot(roots, row.canonicalPath),
    );
  }

  /** Foreign keys cascade the delete to files, chunks, and jobs. */
  async remove(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(repositories)
      .where(eq(repositories.id, id))
      .returning({ id: repositories.id });
    if (deleted.length === 0)
      throw new NotFoundException('Repository not found.');
  }
}
