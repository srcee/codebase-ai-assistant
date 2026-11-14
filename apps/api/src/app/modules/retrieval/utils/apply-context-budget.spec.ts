import type { Locator } from '@codebase-ai/contracts';
import { retrievedChunkFactory } from '../../../../testing/factories/search-candidate.factory';
import { applyContextBudget } from './apply-context-budget';

const budget = { maxChunks: 10, maxContextChars: 10_000 };
const lines = (startLine: number, endLine: number): Locator => ({
  kind: 'lines',
  startLine,
  endLine,
});

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

  it('drops a lower-ranked chunk whose locator overlaps a kept chunk of the same file', () => {
    const kept = retrievedChunkFactory.build({ locator: lines(10, 30) });
    const overlapping = retrievedChunkFactory.build({
      sourceId: kept.sourceId,
      relativePath: kept.relativePath,
      locator: lines(30, 50),
    });
    const adjacent = retrievedChunkFactory.build({
      sourceId: kept.sourceId,
      relativePath: kept.relativePath,
      locator: lines(31, 50),
    });

    expect(applyContextBudget([kept, overlapping, adjacent], budget)).toEqual([
      kept,
      adjacent,
    ]);
  });

  it('keeps the same path and locator from different sources', () => {
    const first = retrievedChunkFactory.build({ locator: lines(1, 10) });
    const other = retrievedChunkFactory.build({
      relativePath: first.relativePath,
      locator: lines(1, 10),
    });
    expect(applyContextBudget([first, other], budget)).toHaveLength(2);
  });

  it('drops a repeated section of the same document', () => {
    const section: Locator = { kind: 'section', headingPath: ['Roles'] };
    const kept = retrievedChunkFactory.build({ locator: section });
    const repeated = retrievedChunkFactory.build({
      sourceId: kept.sourceId,
      relativePath: kept.relativePath,
      locator: section,
    });
    expect(applyContextBudget([kept, repeated], budget)).toEqual([kept]);
  });

  it('returns nothing for no input', () => {
    expect(applyContextBudget([], budget)).toEqual([]);
  });
});
