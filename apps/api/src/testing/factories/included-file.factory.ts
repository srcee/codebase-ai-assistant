import { faker } from '@codebase-ai/shared-testing';
import { Factory } from 'fishery';
import type { IncludedFile } from '../../app/modules/ingestion/types/discovery-entry';

export const includedFileFactory = Factory.define<IncludedFile>(
  ({ sequence }) => ({
    status: 'included',
    relativePath: `src/${faker.word.noun()}-${sequence}.ts`,
    language: 'typescript',
    sizeBytes: faker.number.int({ min: 1, max: 10_000 }),
    contentHash: faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
      prefix: '',
    }),
    text: faker.lorem.sentence() + '\n',
  }),
);
