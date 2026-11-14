import { retrievedChunkFactory } from '../../../../testing/factories/search-candidate.factory';
import { shouldAbstain } from './should-abstain';

describe('shouldAbstain', () => {
  const threshold = 0.5;

  it('abstains without evidence', () => {
    expect(shouldAbstain([], threshold)).toBe(true);
  });

  it('abstains when every vector match is below the threshold and nothing matched lexically', () => {
    const evidence = retrievedChunkFactory.buildList(2, {
      vectorSimilarity: 0.2,
      sources: ['vector'],
    });
    expect(shouldAbstain(evidence, threshold)).toBe(true);
  });

  it('answers when one vector match reaches the threshold', () => {
    const evidence = [
      retrievedChunkFactory.build({ vectorSimilarity: 0.1 }),
      retrievedChunkFactory.build({ vectorSimilarity: 0.5 }),
    ];
    expect(shouldAbstain(evidence, threshold)).toBe(false);
  });

  it('answers when a chunk matched lexically', () => {
    const evidence = [
      retrievedChunkFactory.build({
        vectorSimilarity: 0.1,
        lexicalRank: 1,
        sources: ['vector', 'lexical'],
      }),
    ];
    expect(shouldAbstain(evidence, threshold)).toBe(false);
  });
});
