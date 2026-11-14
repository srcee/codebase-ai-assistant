import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { projects } from '../../lib/schema';
import {
  type DatabaseTransientParams,
  requireDatabase,
} from './database-transient-params';

export type ProjectRow = typeof projects.$inferSelect;

export const projectFactory = Factory.define<
  ProjectRow,
  DatabaseTransientParams
>(({ sequence, onCreate, transientParams }) => {
  onCreate(async (values) => {
    const [row] = await requireDatabase(transientParams)
      .insert(projects)
      .values(values)
      .returning();
    return row;
  });

  const createdAt = faker.date.past();
  return {
    id: faker.string.uuid(),
    name: `${faker.word.noun()}-${sequence}`,
    description: faker.lorem.sentence(),
    createdAt,
    updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
  };
});
