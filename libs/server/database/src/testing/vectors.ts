import { EMBEDDING_DIMENSIONS } from '../lib/schema';

/** A deterministic vector with 1 in the first position, so cosine distance to itself is 0. */
export const unitVector = (dimensions = EMBEDDING_DIMENSIONS): number[] =>
  Array.from({ length: dimensions }, (_, index) => (index === 0 ? 1 : 0));
