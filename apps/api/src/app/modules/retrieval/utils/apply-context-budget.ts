import type { RetrievedChunk } from '../types/retrieved-chunk';
import { locatorsOverlap } from './locators-overlap';

export interface ContextBudget {
  maxChunks: number;
  maxContextChars: number;
}

const overlaps = (a: RetrievedChunk, b: RetrievedChunk): boolean =>
  a.sourceId === b.sourceId &&
  a.relativePath === b.relativePath &&
  locatorsOverlap(a.locator, b.locator);

/** Keeps rank order; a chunk that does not fit is skipped and smaller ones after it still count. */
export function applyContextBudget(
  ranked: readonly RetrievedChunk[],
  budget: ContextBudget,
): RetrievedChunk[] {
  const kept: RetrievedChunk[] = [];
  let characters = 0;
  for (const chunk of ranked) {
    if (kept.length >= budget.maxChunks) break;
    if (characters + chunk.content.length > budget.maxContextChars) continue;
    if (kept.some((other) => overlaps(chunk, other))) continue;
    kept.push(chunk);
    characters += chunk.content.length;
  }
  return kept;
}
