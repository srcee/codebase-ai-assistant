import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { IndexJobsController } from './controllers/index-jobs.controller';
import { FileIndexerService } from './services/file-indexer.service';
import { IndexJobRunnerService } from './services/index-job-runner.service';
import { IndexJobsService } from './services/index-jobs.service';

@Module({
  imports: [DatabaseModule, IngestionModule, EmbeddingsModule],
  controllers: [IndexJobsController],
  providers: [IndexJobsService, FileIndexerService, IndexJobRunnerService],
})
export class IndexingModule {}
