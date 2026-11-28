import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { CodebasesModule } from '../codebases/codebases.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { BlobStoreService } from './services/blob-store.service';
import { CollectionDiscoveryService } from './services/collection-discovery.service';
import { DocumentDiscoveryService } from './services/document-discovery.service';
import { DocumentParsingService } from './services/document-parsing.service';
import { ParsingPoolService } from './services/parsing-pool.service';
import { UploadDiscoveryService } from './services/upload-discovery.service';
import { PARSE_WORKER_ENTRY } from './types/parse-worker-entry';
import { defaultParseWorkerEntry } from './utils/default-parse-worker-entry';

@Module({
  imports: [DatabaseModule, CodebasesModule, IngestionModule],
  providers: [
    {
      provide: PARSE_WORKER_ENTRY,
      useFactory: () => defaultParseWorkerEntry(),
    },
    ParsingPoolService,
    DocumentParsingService,
    DocumentDiscoveryService,
    BlobStoreService,
    UploadDiscoveryService,
    CollectionDiscoveryService,
  ],
  exports: [
    DocumentParsingService,
    CollectionDiscoveryService,
    BlobStoreService,
  ],
})
export class DocumentIngestionModule {}
