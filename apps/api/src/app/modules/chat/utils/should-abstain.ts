import type { RetrievedChunk } from '../../retrieval/types/retrieved-chunk';
import { lexicalTermsFor } from '../../retrieval/utils/build-lexical-query';
import { termCoverage } from './term-coverage';

export interface AbstentionThresholds {
  minVectorSimilarity: number;
  minTermCoverage: number;
}

/** Fused scores are relative, so only the absolute vector similarity and lexical term coverage decide. */
export function shouldAbstain(
  evidence: readonly RetrievedChunk[],
  query: string,
  thresholds: AbstentionThresholds,
): boolean {
  if (evidence.length === 0) return true;
  const best = Math.max(
    ...evidence.map((chunk) => chunk.vectorSimilarity ?? 0),
  );
  if (best >= thresholds.minVectorSimilarity) return false;
  // The lexical search ORs its terms, so one shared common word is not support on its own.
  const terms = lexicalTermsFor(query);
  return !evidence.some(
    (chunk) =>
      chunk.lexicalRank !== undefined &&
      termCoverage(terms, chunk) >= thresholds.minTermCoverage,
  );
}
