import { repositoryFactory } from '@codebase-ai/server-database/testing';
import {
  assertNotLeaked,
  codebaseResponseFactory,
  faker,
} from '@codebase-ai/shared-testing';
import { toCodebaseResponse } from './to-codebase-response';

describe('toCodebaseResponse', () => {
  it('maps a row to display data with ISO timestamps', () => {
    const row = repositoryFactory.build({
      status: 'ready',
      lastIndexedCommit: faker.git.commitSha(),
    });
    const relativePath = faker.word.noun();

    expect(toCodebaseResponse(row, relativePath)).toEqual({
      id: row.id,
      name: row.name,
      relativePath,
      status: 'ready',
      lastIndexedCommit: row.lastIndexedCommit,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  it('keeps a null relative path and a null last indexed commit', () => {
    const response = toCodebaseResponse(repositoryFactory.build(), null);
    expect(response.relativePath).toBeNull();
    expect(response.lastIndexedCommit).toBeNull();
  });

  it('never exposes the canonical path or the privacy mode', () => {
    const row = repositoryFactory.build();
    const response = toCodebaseResponse(row, faker.word.noun());

    assertNotLeaked(response, row.canonicalPath);
    expect(Object.keys(response).sort()).toEqual(
      Object.keys(codebaseResponseFactory.build()).sort(),
    );
  });
});
