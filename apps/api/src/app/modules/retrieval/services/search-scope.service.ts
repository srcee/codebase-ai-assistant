import { BadRequestException, Injectable } from '@nestjs/common';
import type { SearchRequest } from '@codebase-ai/contracts';
import { ProjectScopeService } from '../../projects/services/project-scope.service';

@Injectable()
export class SearchScopeService {
  constructor(private readonly projectScope: ProjectScopeService) {}

  /** Exactly one of `sourceIds` or `projectId`; a project resolves to its sources server-side. */
  async resolve(
    request: Pick<SearchRequest, 'sourceIds' | 'projectId'>,
  ): Promise<string[]> {
    const { sourceIds, projectId } = request;
    if ((sourceIds === undefined) === (projectId === undefined)) {
      throw new BadRequestException('Send either sourceIds or projectId.');
    }
    if (projectId !== undefined) {
      return this.projectScope.resolveSourceIds(projectId);
    }
    return sourceIds ?? [];
  }
}
