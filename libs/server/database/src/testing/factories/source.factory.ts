import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { sources } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type SourceRow = typeof sources.$inferSelect;

/** Builds a complete code repository row, so `build()` can feed code that reads stored rows. */
export const sourceFactory = Factory.define<SourceRow, DatabaseTransientParams>(
  ({ sequence, onCreate, transientParams }) => {
    onCreate(async (values) => {
      const [row] = await requireDatabase(transientParams)
        .insert(sources)
        .values(values)
        .returning();
      return row;
    });

    const name = `${faker.word.noun()}-${sequence}`;
    const createdAt = faker.date.past();
    return {
      id: faker.string.uuid(),
      name,
      kind: 'code_repository',
      origin: null,
      canonicalPath: `/synthetic/${name}`,
      privacyMode: 'local',
      status: 'registered',
      lastIndexedCommit: null,
      createdAt,
      updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
    };
  },
);
