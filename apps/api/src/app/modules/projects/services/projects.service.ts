import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { ProjectResponse } from '@codebase-ai/contracts';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { CreateProjectDto } from '../dto/create-project.dto';
import type { UpdateProjectDto } from '../dto/update-project.dto';
import { toProjectResponse } from '../mappers/to-project-response';

const { projects, projectSources, sources } = schema;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly database: DatabaseService) {}

  async create(request: CreateProjectDto): Promise<ProjectResponse> {
    const [row] = await this.database.db
      .insert(projects)
      .values({ name: request.name, description: request.description ?? null })
      .returning();
    this.logger.log(`Project created id=${row.id}`);
    return toProjectResponse(row, []);
  }

  async list(): Promise<ProjectResponse[]> {
    const db = this.database.db;
    const [rows, links] = await Promise.all([
      db
        .select()
        .from(projects)
        .orderBy(asc(projects.name), asc(projects.createdAt)),
      db
        .select({
          projectId: projectSources.projectId,
          sourceId: projectSources.sourceId,
        })
        .from(projectSources)
        .orderBy(asc(projectSources.sourceId)),
    ]);
    const sourceIdsByProject = new Map<string, string[]>();
    for (const link of links) {
      const ids = sourceIdsByProject.get(link.projectId) ?? [];
      ids.push(link.sourceId);
      sourceIdsByProject.set(link.projectId, ids);
    }
    return rows.map((row) =>
      toProjectResponse(row, sourceIdsByProject.get(row.id) ?? []),
    );
  }

  async get(id: string): Promise<ProjectResponse> {
    const [row] = await this.database.db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    if (!row) throw new NotFoundException('Project not found.');
    return toProjectResponse(row, await this.sourceIdsOf(id));
  }

  async update(
    id: string,
    request: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    const changes = {
      ...(request.name !== undefined ? { name: request.name } : {}),
      ...(request.description !== undefined
        ? { description: request.description }
        : {}),
    };
    if (Object.keys(changes).length === 0) return this.get(id);
    const [row] = await this.database.db
      .update(projects)
      .set(changes)
      .where(eq(projects.id, id))
      .returning();
    if (!row) throw new NotFoundException('Project not found.');
    return toProjectResponse(row, await this.sourceIdsOf(id));
  }

  /** Links cascade; the sources themselves are kept. */
  async remove(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (deleted.length === 0) throw new NotFoundException('Project not found.');
    this.logger.log(`Project deleted id=${id}`);
  }

  async replaceSources(
    id: string,
    sourceIds: readonly string[],
  ): Promise<ProjectResponse> {
    const row = await this.database.db.transaction(async (tx) => {
      // Locks the row so concurrent replacements of the same project run one after another.
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id))
        .for('update');
      if (!project) throw new NotFoundException('Project not found.');

      if (sourceIds.length > 0) {
        const found = await tx
          .select({ id: sources.id })
          .from(sources)
          .where(inArray(sources.id, [...sourceIds]));
        if (found.length !== sourceIds.length) {
          throw new BadRequestException('One or more sources do not exist.');
        }
      }

      await tx.delete(projectSources).where(eq(projectSources.projectId, id));
      if (sourceIds.length > 0) {
        await tx
          .insert(projectSources)
          .values(sourceIds.map((sourceId) => ({ projectId: id, sourceId })));
      }
      const [updated] = await tx
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      return updated;
    });
    this.logger.log(
      `Project sources replaced id=${id} sources=${sourceIds.length}`,
    );
    return toProjectResponse(row, await this.sourceIdsOf(id));
  }

  private async sourceIdsOf(projectId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ sourceId: projectSources.sourceId })
      .from(projectSources)
      .where(eq(projectSources.projectId, projectId))
      .orderBy(asc(projectSources.sourceId));
    return rows.map((row) => row.sourceId);
  }
}
