import type { Locator } from '@codebase-ai/contracts';
import { locatorsOverlap } from '../../app/modules/retrieval/utils/locators-overlap';
import type { ExpectedLocation, QuestionCategory } from './eval-questions';

/** Where a result can be cited from; retrieval candidates already have this shape. */
export interface ResultLocation {
  relativePath: string;
  locator: Locator;
}

export const SEARCH_MODES = ['vector', 'lexical', 'hybrid'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const MRR_CUTOFF = 10;

/** A result hits an expected location when it is in the same file and its locator overlaps the expected lines. */
export function isHit(
  result: ResultLocation,
  expected: Pick<ExpectedLocation, 'path' | 'startLine' | 'endLine'>,
): boolean {
  return (
    result.relativePath === expected.path &&
    locatorsOverlap(result.locator, {
      kind: 'lines',
      startLine: expected.startLine,
      endLine: expected.endLine,
    })
  );
}

export function recallAtK(
  results: readonly ResultLocation[],
  expected: readonly ExpectedLocation[],
  k: number,
): number {
  const top = results.slice(0, k);
  const found = expected.filter((location) =>
    top.some((result) => isHit(result, location)),
  );
  return found.length / expected.length;
}

export function reciprocalRank(
  results: readonly ResultLocation[],
  expected: readonly ExpectedLocation[],
  cutoff = MRR_CUTOFF,
): number {
  const index = results
    .slice(0, cutoff)
    .findIndex((result) =>
      expected.some((location) => isHit(result, location)),
    );
  return index === -1 ? 0 : 1 / (index + 1);
}

export interface QuestionScore {
  id: string;
  category: QuestionCategory;
  recallAt5: number;
  recallAt10: number;
  reciprocalRank: number;
  latencyMs: number;
}

export function scoreQuestion(
  question: {
    id: string;
    category: QuestionCategory;
    expected: readonly ExpectedLocation[];
  },
  results: readonly ResultLocation[],
  latencyMs: number,
): QuestionScore {
  return {
    id: question.id,
    category: question.category,
    recallAt5: recallAtK(results, question.expected, 5),
    recallAt10: recallAtK(results, question.expected, 10),
    reciprocalRank: reciprocalRank(results, question.expected),
    latencyMs,
  };
}

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Nearest-rank method. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export interface CategorySummary {
  questions: number;
  recallAt10: number;
  mrrAt10: number;
}

export interface ModeSummary {
  recallAt5: number;
  recallAt10: number;
  mrrAt10: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  byCategory: Partial<Record<QuestionCategory, CategorySummary>>;
  /** Ids of questions that missed at least one expected location in the top 10. */
  incomplete: string[];
}

export function summarizeScores(scores: readonly QuestionScore[]): ModeSummary {
  const byCategory: ModeSummary['byCategory'] = {};
  for (const category of new Set(scores.map((score) => score.category))) {
    const inCategory = scores.filter((score) => score.category === category);
    byCategory[category] = {
      questions: inCategory.length,
      recallAt10: mean(inCategory.map((score) => score.recallAt10)),
      mrrAt10: mean(inCategory.map((score) => score.reciprocalRank)),
    };
  }
  const latencies = scores.map((score) => score.latencyMs);
  return {
    recallAt5: mean(scores.map((score) => score.recallAt5)),
    recallAt10: mean(scores.map((score) => score.recallAt10)),
    mrrAt10: mean(scores.map((score) => score.reciprocalRank)),
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    byCategory,
    incomplete: scores
      .filter((score) => score.recallAt10 < 1)
      .map((score) => score.id),
  };
}
