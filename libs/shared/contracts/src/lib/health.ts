export type DatabaseStatus = 'up' | 'down' | 'unconfigured';

export interface DatabaseHealth {
  status: DatabaseStatus;
  vectorExtension: boolean;
  /** Dimension of the code_chunks.embedding column; null when the schema is not migrated. */
  embeddingDimensions: number | null;
}

export interface InferenceModelHealth {
  name: string;
  /** True when the local runtime reports the model as pulled. */
  available: boolean;
}

export interface InferenceHealth {
  provider: 'local';
  /** Configured runtime adapter, for example `ollama`. */
  runtime: string;
  status: 'up' | 'down';
  embeddingModel: InferenceModelHealth;
  chatModel: InferenceModelHealth;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: DatabaseHealth;
  inference: InferenceHealth;
}
