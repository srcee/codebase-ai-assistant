import { EMBEDDING_DIMENSIONS } from '../lib/schema';

/** A deterministic vector with 1 in the first position, so cosine distance to itself is 0. */
export const unitVector = (dimensions = EMBEDDING_DIMENSIONS): number[] =>
  Array.from({ length: dimensions }, (_, index) => (index === 0 ? 1 : 0));

/** Vectors on different axes are orthogonal, so their cosine distance is 1. */
export const axisVector = (
  axis: number,
  dimensions = EMBEDDING_DIMENSIONS,
): number[] =>
  Array.from({ length: dimensions }, (_, index) => (index === axis ? 1 : 0));
