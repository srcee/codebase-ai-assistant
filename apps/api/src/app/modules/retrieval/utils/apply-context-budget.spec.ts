import { retrievedChunkFactory } from '../../../../testing/factories/search-candidate.factory';
import { applyContextBudget } from './apply-context-budget';

const budget = { maxChunks: 10, maxContextChars: 10_000 };

describe('applyContextBudget', () => {
  it('keeps rank order', () => {
    const ranked = retrievedChunkFactory.buildList(4);
    expect(applyContextBudget(ranked, budget)).toEqual(ranked);
  });

  it('stops at the chunk limit', () => {
    const ranked = retrievedChunkFactory.buildList(5);
    expect(applyContextBudget(ranked, { ...budget, maxChunks: 2 })).toEqual(
      ranked.slice(0, 2),
    );
  });

  it('skips a chunk that would exceed the character limit and keeps smaller ones', () => {
    const first = retrievedChunkFactory.build({ content: 'a'.repeat(60) });
    const tooBig = retrievedChunkFactory.build({ content: 'b'.repeat(60) });
    const small = retrievedChunkFactory.build({ content: 'c'.repeat(30) });

    expect(
      applyContextBudget([first, tooBig, small], {
        ...budget,
        maxContextChars: 100,
      }),
    ).toEqual([first, small]);
  });

  it('drops a lower-ranked chunk whose lines overlap a kept chunk of the same file', () => {
    const kept = retrievedChunkFactory.build({ startLine: 10, endLine: 30 });
    const overlapping = retrievedChunkFactory.build({
      repositoryId: kept.repositoryId,
      relativePath: kept.relativePath,
      startLine: 30,
      endLine: 50,
    });
    const adjacent = retrievedChunkFactory.build({
      repositoryId: kept.repositoryId,
      relativePath: kept.relativePath,
      startLine: 31,
      endLine: 50,
    });

    expect(applyContextBudget([kept, overlapping, adjacent], budget)).toEqual([
      kept,
      adjacent,
    ]);
  });

  it('keeps the same path and lines from different repositories', () => {
    const first = retrievedChunkFactory.build({ startLine: 1, endLine: 10 });
    const other = retrievedChunkFactory.build({
      relativePath: first.relativePath,
      startLine: 1,
      endLine: 10,
    });
    expect(applyContextBudget([first, other], budget)).toHaveLength(2);
  });

  it('returns nothing for no input', () => {
    expect(applyContextBudget([], budget)).toEqual([]);
  });
});
