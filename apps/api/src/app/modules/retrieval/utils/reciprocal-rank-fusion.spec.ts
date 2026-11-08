import { searchCandidateFactory } from '../../../../testing/factories/search-candidate.factory';
import { reciprocalRankFusion } from './reciprocal-rank-fusion';

const K = 60;

describe('reciprocalRankFusion', () => {
  it('ranks a chunk found by both searches above chunks found by one', () => {
    const [shared, vectorOnly, lexicalOnly] =
      searchCandidateFactory.buildList(3);

    const fused = reciprocalRankFusion(
      [vectorOnly, shared],
      [lexicalOnly, shared],
      K,
    );

    expect(fused[0]).toMatchObject({
      chunkId: shared.chunkId,
      sources: ['vector', 'lexical'],
      vectorRank: 2,
      lexicalRank: 2,
    });
    expect(fused[0].score).toBeCloseTo(2 / (K + 2));
  });

  it('records the source and rank of single-search results', () => {
    const [vectorOnly, lexicalOnly] = searchCandidateFactory.buildList(2);

    const fused = reciprocalRankFusion([vectorOnly], [lexicalOnly], K);

    const byId = new Map(fused.map((chunk) => [chunk.chunkId, chunk]));
    expect(byId.get(vectorOnly.chunkId)).toMatchObject({
      sources: ['vector'],
      vectorRank: 1,
    });
    expect(byId.get(vectorOnly.chunkId)?.lexicalRank).toBeUndefined();
    expect(byId.get(lexicalOnly.chunkId)).toMatchObject({
      sources: ['lexical'],
      lexicalRank: 1,
    });
  });

  it('breaks score ties by the better rank, then the chunk id', () => {
    const a = searchCandidateFactory.build({ chunkId: 'a' });
    const b = searchCandidateFactory.build({ chunkId: 'b' });
    const c = searchCandidateFactory.build({ chunkId: 'c' });

    const fused = reciprocalRankFusion([a], [b], K);
    expect(fused.map((chunk) => chunk.chunkId)).toEqual(['a', 'b']);

    const withThird = reciprocalRankFusion([a, c], [b], K);
    expect(withThird.map((chunk) => chunk.chunkId)).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for empty inputs', () => {
    expect(reciprocalRankFusion([], [], K)).toEqual([]);
  });

  it('keeps the candidate fields', () => {
    const candidate = searchCandidateFactory.build();
    const [fused] = reciprocalRankFusion([candidate], [], K);
    expect(fused).toMatchObject(candidate);
  });
});
