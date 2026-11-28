import { faker } from '@codebase-ai/shared-testing';
import { CollectionRootChangedError } from '../errors/collection-root-changed.error';
import type { DocumentEntry } from '../types/document-entry';
import { CollectionDiscoveryService } from './collection-discovery.service';
import type { DocumentDiscoveryService } from './document-discovery.service';
import type { UploadDiscoveryService } from './upload-discovery.service';

describe('CollectionDiscoveryService', () => {
  const entry: DocumentEntry = {
    status: 'skipped',
    relativePath: `${faker.word.noun()}.md`,
    kind: 'file',
    reason: 'too-large',
  };
  const folders = {
    discover: jest.fn(async function* () {
      yield entry;
    }),
  };
  const uploads = {
    discover: jest.fn(async function* () {
      yield entry;
    }),
  };
  const service = new CollectionDiscoveryService(
    folders as unknown as DocumentDiscoveryService,
    uploads as unknown as UploadDiscoveryService,
  );

  const collect = async (
    collection: Parameters<CollectionDiscoveryService['discover']>[0],
  ): Promise<DocumentEntry[]> => {
    const entries: DocumentEntry[] = [];
    for await (const found of service.discover(collection)) entries.push(found);
    return entries;
  };

  beforeEach(() => jest.clearAllMocks());

  it('lists upload collections from their rows', async () => {
    const id = faker.string.uuid();
    expect(
      await collect({ id, origin: 'upload', canonicalPath: null }),
    ).toEqual([entry]);
    expect(uploads.discover).toHaveBeenCalledWith(id);
    expect(folders.discover).not.toHaveBeenCalled();
  });

  it('walks folder collections from their path', async () => {
    const path = faker.system.directoryPath();
    await collect({
      id: faker.string.uuid(),
      origin: 'folder',
      canonicalPath: path,
    });
    expect(folders.discover).toHaveBeenCalledWith(path);
    expect(uploads.discover).not.toHaveBeenCalled();
  });

  it('fails a folder collection without a path', async () => {
    await expect(
      collect({
        id: faker.string.uuid(),
        origin: 'folder',
        canonicalPath: null,
      }),
    ).rejects.toBeInstanceOf(CollectionRootChangedError);
  });
});
