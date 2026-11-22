import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ProjectSyncResponse } from '@codebase-ai/contracts';
import { ProjectScopeService } from '../../projects/services/project-scope.service';
import { IndexJobRunnerService } from './index-job-runner.service';

@Injectable()
export class ProjectSyncService {
  private readonly logger = new Logger(ProjectSyncService.name);

  constructor(
    private readonly scope: ProjectScopeService,
    private readonly runner: IndexJobRunnerService,
  ) {}

  /** One job per source of the project, code or documents; a source with an active job is reported, not queued again. */
  async sync(projectId: string): Promise<ProjectSyncResponse> {
    const response: ProjectSyncResponse = { started: [], alreadyActive: [] };
    for (const sourceId of await this.scope.resolveSourceIds(projectId)) {
      try {
        const { job, alreadyActive } = await this.runner.trySync(sourceId);
        (alreadyActive ? response.alreadyActive : response.started).push(job);
      } catch (error) {
        // A source deleted since the project was read has left the project.
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    this.logger.log(
      `Project sync project=${projectId} started=${response.started.length} alreadyActive=${response.alreadyActive.length}`,
    );
    return response;
  }
}
