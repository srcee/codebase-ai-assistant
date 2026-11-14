import type { RetrievedChunk } from '../../retrieval/types/retrieved-chunk';

/** Fused scores are relative, so only the absolute vector similarity and lexical matches decide. */
export function shouldAbstain(
  evidence: readonly RetrievedChunk[],
  minVectorSimilarity: number,
): boolean {
  if (evidence.length === 0) return true;
  if (evidence.some((chunk) => chunk.lexicalRank !== undefined)) return false;
  const best = Math.max(
    ...evidence.map((chunk) => chunk.vectorSimilarity ?? 0),
  );
  return best < minVectorSimilarity;
}
