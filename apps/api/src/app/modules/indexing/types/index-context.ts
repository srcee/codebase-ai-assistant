export interface IndexContext {
  sourceId: string;
  /** `<runtime>/<model>` of the embedding model. */
  embeddingModel: string;
  signal: AbortSignal;
}
