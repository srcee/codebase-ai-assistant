import { Factory } from 'fishery';
import type { CodebaseResponse, CodebaseStatus } from '@codebase-ai/contracts';
import { faker } from '../faker';

const STATUSES: readonly CodebaseStatus[] = [
  'registered',
  'indexing',
  'ready',
  'failed',
];

export const codebaseResponseFactory = Factory.define<CodebaseResponse>(
  ({ sequence }) => {
    const name = `${faker.word.noun()}-${sequence}`;
    const createdAt = faker.date.past();
    return {
      id: faker.string.uuid(),
      name,
      relativePath: name,
      status: faker.helpers.arrayElement(STATUSES),
      lastIndexedCommit: faker.git.commitSha(),
      createdAt: createdAt.toISOString(),
      updatedAt: faker.date
        .between({ from: createdAt, to: new Date() })
        .toISOString(),
    };
  },
);
