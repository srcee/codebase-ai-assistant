import { Injectable } from '@nestjs/common';
import type { DocumentOrigin } from '@codebase-ai/contracts';
import { CollectionRootChangedError } from '../errors/collection-root-changed.error';
import type { DocumentEntry } from '../types/document-entry';
import { DocumentDiscoveryService } from './document-discovery.service';
import { UploadDiscoveryService } from './upload-discovery.service';

export interface CollectionToDiscover {
  id: string;
  origin: DocumentOrigin | null;
  canonicalPath: string | null;
}

/** Lists the documents of a collection: uploads from the database, folders from disk. */
@Injectable()
export class CollectionDiscoveryService {
  constructor(
    private readonly folders: DocumentDiscoveryService,
    private readonly uploads: UploadDiscoveryService,
  ) {}

  async *discover(
    collection: CollectionToDiscover,
  ): AsyncGenerator<DocumentEntry> {
    if (collection.origin === 'upload') {
      yield* this.uploads.discover(collection.id);
      return;
    }
    if (collection.canonicalPath === null) {
      throw new CollectionRootChangedError();
    }
    yield* this.folders.discover(collection.canonicalPath);
  }
}
