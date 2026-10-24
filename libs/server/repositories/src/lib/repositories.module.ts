import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { PathPolicyService } from './path-policy/path-policy.service';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RepositoriesController],
  providers: [PathPolicyService, RepositoriesService],
  exports: [PathPolicyService],
})
export class RepositoriesModule {}
