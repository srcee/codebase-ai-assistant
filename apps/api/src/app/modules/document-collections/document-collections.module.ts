import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { CodebasesModule } from '../codebases/codebases.module';
import { DocumentCollectionsController } from './controllers/document-collections.controller';
import { DocumentCollectionsService } from './services/document-collections.service';

@Module({
  imports: [DatabaseModule, CodebasesModule],
  controllers: [DocumentCollectionsController],
  providers: [DocumentCollectionsService],
})
export class DocumentCollectionsModule {}
