import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService, schema } from '@codebase-ai/server-database';

const { projects, projectSources } = schema;

/** Resolves a project to the sources that scope retrieval; used by search and, later, chat. */
@Injectable()
export class ProjectScopeService {
  constructor(private readonly database: DatabaseService) {}

  async resolveSourceIds(projectId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ projectId: projects.id, sourceId: projectSources.sourceId })
      .from(projects)
      .leftJoin(projectSources, eq(projectSources.projectId, projects.id))
      .where(eq(projects.id, projectId));
    if (rows.length === 0) throw new NotFoundException('Project not found.');
    return rows.flatMap((row) => (row.sourceId ? [row.sourceId] : []));
  }
}
