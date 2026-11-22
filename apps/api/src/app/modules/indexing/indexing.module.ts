import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { DocumentIngestionModule } from '../document-ingestion/document-ingestion.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ProjectsModule } from '../projects/projects.module';
import { CollectionSyncController } from './controllers/collection-sync.controller';
import { IndexJobsController } from './controllers/index-jobs.controller';
import { ProjectSyncController } from './controllers/project-sync.controller';
import { DocumentIndexerService } from './services/document-indexer.service';
import { FileIndexerService } from './services/file-indexer.service';
import { IndexJobRunnerService } from './services/index-job-runner.service';
import { IndexJobsService } from './services/index-jobs.service';
import { ProjectSyncService } from './services/project-sync.service';
import { SourceChangesService } from './services/source-changes.service';

@Module({
  imports: [
    DatabaseModule,
    IngestionModule,
    DocumentIngestionModule,
    EmbeddingsModule,
    ProjectsModule,
  ],
  controllers: [
    IndexJobsController,
    CollectionSyncController,
    ProjectSyncController,
  ],
  providers: [
    IndexJobsService,
    FileIndexerService,
    DocumentIndexerService,
    IndexJobRunnerService,
    SourceChangesService,
    ProjectSyncService,
  ],
})
export class IndexingModule {}
