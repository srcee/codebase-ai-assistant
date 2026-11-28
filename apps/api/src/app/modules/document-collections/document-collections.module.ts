import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { CodebasesModule } from '../codebases/codebases.module';
import { DocumentIngestionModule } from '../document-ingestion/document-ingestion.module';
import { IndexingModule } from '../indexing/indexing.module';
import { CollectionDocumentsController } from './controllers/collection-documents.controller';
import { DocumentCollectionsController } from './controllers/document-collections.controller';
import { DocumentCollectionsService } from './services/document-collections.service';
import { DocumentUploadsService } from './services/document-uploads.service';
import { UploadReceiverService } from './services/upload-receiver.service';

@Module({
  imports: [
    DatabaseModule,
    CodebasesModule,
    DocumentIngestionModule,
    IndexingModule,
  ],
  controllers: [DocumentCollectionsController, CollectionDocumentsController],
  providers: [
    DocumentCollectionsService,
    DocumentUploadsService,
    UploadReceiverService,
  ],
})
export class DocumentCollectionsModule {}
