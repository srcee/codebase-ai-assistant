import { Factory } from 'fishery';
import type { DocumentSummary } from '@codebase-ai/contracts';
import { faker } from '../faker';

export const documentSummaryFactory = Factory.define<DocumentSummary>(
  ({ sequence }) => ({
    id: faker.string.uuid(),
    logicalPath: `specs/${faker.word.noun()}-${sequence}.md`,
    sizeBytes: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'text/markdown',
    updatedAt: faker.date.past().toISOString(),
  }),
);
