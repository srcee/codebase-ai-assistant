import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { ProjectsModule } from '../projects/projects.module';
import { SearchController } from './controllers/search.controller';
import { RetrievalDebugEnabledGuard } from './guards/retrieval-debug-enabled.guard';
import { LexicalSearchService } from './services/lexical-search.service';
import { RetrievalService } from './services/retrieval.service';
import { SearchScopeService } from './services/search-scope.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  imports: [DatabaseModule, EmbeddingsModule, ProjectsModule],
  controllers: [SearchController],
  providers: [
    RetrievalDebugEnabledGuard,
    VectorSearchService,
    LexicalSearchService,
    RetrievalService,
    SearchScopeService,
  ],
  exports: [RetrievalService, SearchScopeService],
})
export class RetrievalModule {}
