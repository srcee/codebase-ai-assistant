export type DatabaseStatus = 'up' | 'down' | 'unconfigured';

export interface DatabaseHealth {
  status: DatabaseStatus;
  vectorExtension: boolean;
  /** Dimension of the code_chunks.embedding column; null when the schema is not migrated. */
  embeddingDimensions: number | null;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: DatabaseHealth;
}
