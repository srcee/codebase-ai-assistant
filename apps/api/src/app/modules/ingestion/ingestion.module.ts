import { Module } from '@nestjs/common';
import { CodebasesModule } from '../codebases/codebases.module';
import { ChunkingService } from './services/chunking.service';
import { DirectoryWalkerService } from './services/directory-walker.service';
import { ExclusionPolicyService } from './services/exclusion-policy.service';
import { FileDiscoveryService } from './services/file-discovery.service';

@Module({
  imports: [CodebasesModule],
  providers: [
    ExclusionPolicyService,
    DirectoryWalkerService,
    FileDiscoveryService,
    ChunkingService,
  ],
  exports: [DirectoryWalkerService, FileDiscoveryService, ChunkingService],
})
export class IngestionModule {}
