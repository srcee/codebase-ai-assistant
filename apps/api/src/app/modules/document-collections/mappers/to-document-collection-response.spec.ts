import { folderCollectionFactory } from '@codebase-ai/server-database/testing';
import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import { toDocumentCollectionResponse } from './to-document-collection-response';

describe('toDocumentCollectionResponse', () => {
  it('maps a row to display data with ISO timestamps', () => {
    const row = folderCollectionFactory.build({ status: 'ready' });
    const relativePath = faker.word.noun();

    expect(toDocumentCollectionResponse(row, relativePath)).toEqual({
      id: row.id,
      name: row.name,
      origin: 'folder',
      relativePath,
      status: 'ready',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  it('never exposes the canonical path or the privacy mode', () => {
    const row = folderCollectionFactory.build();
    const response = toDocumentCollectionResponse(row, null);
    assertNotLeaked(response, row.canonicalPath);
    expect(response).not.toHaveProperty('privacyMode');
    expect(response.relativePath).toBeNull();
  });
});
