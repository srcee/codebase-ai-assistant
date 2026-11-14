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
