import type { RetrievedChunk } from '../types/retrieved-chunk';

export interface ContextBudget {
  maxChunks: number;
  maxContextChars: number;
}

const overlaps = (a: RetrievedChunk, b: RetrievedChunk): boolean =>
  a.repositoryId === b.repositoryId &&
  a.relativePath === b.relativePath &&
  a.startLine <= b.endLine &&
  b.startLine <= a.endLine;

/** Walks chunks in rank order, dropping any that overlap a kept chunk of the same file or would exceed the budget. */
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
