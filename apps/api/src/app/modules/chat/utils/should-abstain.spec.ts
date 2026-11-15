import { retrievedChunkFactory } from '../../../../testing/factories/search-candidate.factory';
import { shouldAbstain } from './should-abstain';

describe('shouldAbstain', () => {
  const thresholds = { minVectorSimilarity: 0.5, minTermCoverage: 0.5 };
  const query = 'How is the invoice total computed for refunds?';

  it('abstains without evidence', () => {
    expect(shouldAbstain([], query, thresholds)).toBe(true);
  });

  it('abstains when every vector match is below the threshold and nothing matched lexically', () => {
    const evidence = retrievedChunkFactory.buildList(2, {
      vectorSimilarity: 0.2,
      sources: ['vector'],
    });
    expect(shouldAbstain(evidence, query, thresholds)).toBe(true);
  });

  it('answers when one vector match reaches the threshold', () => {
    const evidence = [
      retrievedChunkFactory.build({ vectorSimilarity: 0.1 }),
      retrievedChunkFactory.build({ vectorSimilarity: 0.5 }),
    ];
    expect(shouldAbstain(evidence, query, thresholds)).toBe(false);
  });

  it('answers when a lexical match covers enough of the query terms', () => {
    const evidence = [
      retrievedChunkFactory.build({
        vectorSimilarity: 0.1,
        lexicalRank: 1,
        sources: ['vector', 'lexical'],
        title: null,
        relativePath: 'src/billing.ts',
        content: 'export function invoiceTotal() { /* computed */ }',
      }),
    ];
    expect(shouldAbstain(evidence, query, thresholds)).toBe(false);
  });

  it('abstains when the lexical match shares only one common word', () => {
    const evidence = [
      retrievedChunkFactory.build({
        vectorSimilarity: 0.1,
        lexicalRank: 1,
        sources: ['vector', 'lexical'],
        title: null,
        relativePath: 'src/colours.ts',
        content: 'The total number of colours.',
      }),
    ];
    expect(shouldAbstain(evidence, query, thresholds)).toBe(true);
  });

  it('accepts any lexical match when the coverage threshold is zero', () => {
    const evidence = [
      retrievedChunkFactory.build({
        vectorSimilarity: 0.1,
        lexicalRank: 1,
        sources: ['vector', 'lexical'],
        content: 'unrelated',
      }),
    ];
    expect(
      shouldAbstain(evidence, query, { ...thresholds, minTermCoverage: 0 }),
    ).toBe(false);
  });
});
