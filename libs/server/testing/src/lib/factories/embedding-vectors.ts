import { faker } from '@codebase-ai/shared-testing';

/** Random unit-range vectors in any runtime's response shape. */
export function buildEmbeddingVectors(
  count: number,
  dimensions: number,
): number[][] {
  return Array.from({ length: count }, () =>
    Array.from({ length: dimensions }, () =>
      faker.number.float({ min: -1, max: 1 }),
    ),
  );
}
