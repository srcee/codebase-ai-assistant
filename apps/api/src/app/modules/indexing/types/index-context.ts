export interface IndexContext {
  repositoryId: string;
  /** `<runtime>/<model>` of the embedding model. */
  embeddingModel: string;
  chunkingVersion: string;
  signal: AbortSignal;
}
