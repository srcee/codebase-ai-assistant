import { Module } from '@nestjs/common';
import { CodebasesModule } from '../codebases/codebases.module';
import { ChunkingService } from './services/chunking.service';
import { ExclusionPolicyService } from './services/exclusion-policy.service';
import { FileDiscoveryService } from './services/file-discovery.service';

@Module({
  imports: [CodebasesModule],
  providers: [ExclusionPolicyService, FileDiscoveryService, ChunkingService],
  exports: [FileDiscoveryService, ChunkingService],
})
export class IngestionModule {}
