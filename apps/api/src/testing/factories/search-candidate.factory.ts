import { faker } from '@codebase-ai/shared-testing';
import { Factory } from 'fishery';
import type { RetrievedChunk } from '../../app/modules/retrieval/types/retrieved-chunk';
import type { SearchCandidate } from '../../app/modules/retrieval/types/search-candidate';

export const searchCandidateFactory = Factory.define<SearchCandidate>(
  ({ sequence }) => {
    const startLine = faker.number.int({ min: 1, max: 500 });
    return {
      chunkId: faker.string.uuid(),
      sourceId: faker.string.uuid(),
      sourceName: `${faker.word.noun()}-${sequence}`,
      sourceKind: 'code_repository',
      relativePath: `src/${faker.word.noun()}-${sequence}.ts`,
      title: faker.word.noun(),
      contentKind: 'code',
      locator: {
        kind: 'lines',
        startLine,
        endLine: startLine + faker.number.int({ min: 0, max: 40 }),
      },
      content: faker.lorem.sentence(),
    };
  },
);

export const retrievedChunkFactory = Factory.define<RetrievedChunk>(() => ({
  ...searchCandidateFactory.build(),
  score: faker.number.float({ min: 0, max: 1 }),
  sources: ['vector'],
}));
