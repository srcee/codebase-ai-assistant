/** Lengths only: vectors and input text never appear in the message. */
export class EmbeddingDimensionMismatchError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(
      `Embedding model returned ${actual} dimensions but EMBEDDING_DIMENSIONS is ${expected}`,
    );
    this.name = 'EmbeddingDimensionMismatchError';
  }
}
