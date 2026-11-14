import { projectFactory } from '@codebase-ai/server-database/testing';
import { faker } from '@codebase-ai/shared-testing';
import { toProjectResponse } from './to-project-response';

describe('toProjectResponse', () => {
  it('maps a row and its source ids with ISO timestamps', () => {
    const row = projectFactory.build();
    const sourceIds = [faker.string.uuid(), faker.string.uuid()];

    expect(toProjectResponse(row, sourceIds)).toEqual({
      id: row.id,
      name: row.name,
      description: row.description,
      sourceIds,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  it('copies the source ids', () => {
    const sourceIds = [faker.string.uuid()];
    const response = toProjectResponse(projectFactory.build(), sourceIds);
    sourceIds.push(faker.string.uuid());
    expect(response.sourceIds).toHaveLength(1);
  });
});
