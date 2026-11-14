import { Factory } from 'fishery';
import type { CreateProjectRequest } from '@codebase-ai/contracts';
import { faker } from '../faker';

export const createProjectRequestFactory = Factory.define<CreateProjectRequest>(
  ({ sequence }) => ({
    name: `${faker.word.noun()}-${sequence}`,
    description: faker.lorem.sentence(),
  }),
);
