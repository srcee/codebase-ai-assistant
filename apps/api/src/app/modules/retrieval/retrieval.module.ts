import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { SearchController } from './controllers/search.controller';
import { RetrievalDebugEnabledGuard } from './guards/retrieval-debug-enabled.guard';
import { LexicalSearchService } from './services/lexical-search.service';
import { RetrievalService } from './services/retrieval.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  imports: [DatabaseModule, EmbeddingsModule],
  controllers: [SearchController],
  providers: [
    RetrievalDebugEnabledGuard,
    VectorSearchService,
    LexicalSearchService,
    RetrievalService,
  ],
  exports: [RetrievalService],
})
export class RetrievalModule {}
