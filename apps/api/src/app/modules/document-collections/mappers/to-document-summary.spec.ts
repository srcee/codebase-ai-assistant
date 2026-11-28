import { documentFactory } from '@codebase-ai/server-database/testing';
import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import { toDocumentSummary } from './to-document-summary';

describe('toDocumentSummary', () => {
  it('maps a row to display data without the blob hash', () => {
    const createdAt = faker.date.past();
    const row = {
      ...documentFactory.build(),
      id: faker.string.uuid(),
      createdAt,
      updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
    };

    const summary = toDocumentSummary(row);
    expect(summary).toEqual({
      id: row.id,
      logicalPath: row.logicalPath,
      sizeBytes: row.sizeBytes,
      mediaType: row.mediaType,
      updatedAt: row.updatedAt.toISOString(),
    });
    assertNotLeaked(summary, row.blobHash);
  });
});
