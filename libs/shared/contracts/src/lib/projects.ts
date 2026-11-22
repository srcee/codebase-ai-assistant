import type { IndexJobResponse } from './index-jobs';

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
}

export interface ReplaceProjectSourcesRequest {
  sourceIds: string[];
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** One job per source of the project; a source that already has an active job is reported, not queued again. */
export interface ProjectSyncResponse {
  started: IndexJobResponse[];
  alreadyActive: IndexJobResponse[];
}
