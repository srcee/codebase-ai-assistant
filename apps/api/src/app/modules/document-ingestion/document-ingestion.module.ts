import { Module } from '@nestjs/common';
import { CodebasesModule } from '../codebases/codebases.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { DocumentDiscoveryService } from './services/document-discovery.service';
import { DocumentParsingService } from './services/document-parsing.service';
import { ParsingPoolService } from './services/parsing-pool.service';
import { PARSE_WORKER_ENTRY } from './types/parse-worker-entry';
import { defaultParseWorkerEntry } from './utils/default-parse-worker-entry';

@Module({
  imports: [CodebasesModule, IngestionModule],
  providers: [
    {
      provide: PARSE_WORKER_ENTRY,
      useFactory: () => defaultParseWorkerEntry(),
    },
    ParsingPoolService,
    DocumentParsingService,
    DocumentDiscoveryService,
  ],
  exports: [DocumentParsingService, DocumentDiscoveryService],
})
export class DocumentIngestionModule {}
