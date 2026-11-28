import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { DatabaseService, schema } from '@codebase-ai/server-database';
import type { SkippedEntry } from '../../ingestion/types/discovery-entry';
import type { SkipReason } from '../../ingestion/types/skip-reason';
import type { DocumentEntry } from '../types/document-entry';
import { documentFormatFor } from '../utils/document-format-for';
import { BlobStoreService } from './blob-store.service';

const { documents } = schema;

/** Lists the documents of an upload collection; blobs are read only when a document is parsed. */
@Injectable()
export class UploadDiscoveryService {
  private readonly maxBytes: number;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly database: DatabaseService,
    private readonly blobs: BlobStoreService,
  ) {
    this.maxBytes = config.documents.maxBytes;
  }

  async *discover(collectionId: string): AsyncGenerator<DocumentEntry> {
    const rows = await this.database.db
      .select({
        logicalPath: documents.logicalPath,
        blobHash: documents.blobHash,
        sizeBytes: documents.sizeBytes,
      })
      .from(documents)
      .where(eq(documents.sourceId, collectionId))
      .orderBy(asc(documents.logicalPath));

    for (const row of rows) {
      const format = documentFormatFor(row.logicalPath);
      // The limits may have been lowered since the upload.
      if (!format) yield skipped(row.logicalPath, 'unsupported-extension');
      else if (row.sizeBytes > this.maxBytes) {
        yield skipped(row.logicalPath, 'too-large');
      } else {
        yield {
          status: 'included',
          relativePath: row.logicalPath,
          format,
          sizeBytes: row.sizeBytes,
          contentHash: row.blobHash,
          load: () => this.blobs.read(row.blobHash),
        };
      }
    }
  }
}

function skipped(relativePath: string, reason: SkipReason): SkippedEntry {
  return { status: 'skipped', relativePath, kind: 'file', reason };
}
