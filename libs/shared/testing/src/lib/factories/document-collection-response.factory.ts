import { Factory } from 'fishery';
import type {
  DocumentCollectionResponse,
  DocumentOrigin,
  SourceStatus,
} from '@codebase-ai/contracts';
import { faker } from '../faker';

const ORIGINS: readonly DocumentOrigin[] = ['folder', 'upload'];

const STATUSES: readonly SourceStatus[] = [
  'registered',
  'indexing',
  'ready',
  'failed',
];

export const documentCollectionResponseFactory =
  Factory.define<DocumentCollectionResponse>(({ sequence }) => {
    const name = `${faker.word.noun()}-docs-${sequence}`;
    const origin = faker.helpers.arrayElement(ORIGINS);
    const createdAt = faker.date.past();
    return {
      id: faker.string.uuid(),
      name,
      origin,
      relativePath: origin === 'folder' ? name : null,
      status: faker.helpers.arrayElement(STATUSES),
      createdAt: createdAt.toISOString(),
      updatedAt: faker.date
        .between({ from: createdAt, to: new Date() })
        .toISOString(),
    };
  });
