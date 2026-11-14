import { Factory } from 'fishery';
import type { ProjectResponse } from '@codebase-ai/contracts';
import { faker } from '../faker';

export const projectResponseFactory = Factory.define<ProjectResponse>(
  ({ sequence }) => {
    const createdAt = faker.date.past();
    return {
      id: faker.string.uuid(),
      name: `${faker.word.noun()}-${sequence}`,
      description: faker.lorem.sentence(),
      sourceIds: [faker.string.uuid()],
      createdAt: createdAt.toISOString(),
      updatedAt: faker.date
        .between({ from: createdAt, to: new Date() })
        .toISOString(),
    };
  },
);
