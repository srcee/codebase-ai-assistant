import { Factory } from 'fishery';
import type { CreateCodebaseRequest } from '@codebase-ai/contracts';
import { faker } from '../faker';

export const createCodebaseRequestFactory =
  Factory.define<CreateCodebaseRequest>(({ sequence }) => ({
    path: `${faker.system.directoryPath()}/${faker.word.noun()}-${sequence}`,
    name: `${faker.word.noun()}-${sequence}`,
  }));
