import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { CodebasesController } from './controllers/codebases.controller';
import { PathPolicyService } from './services/path-policy.service';
import { CodebasesService } from './services/codebases.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CodebasesController],
  providers: [PathPolicyService, CodebasesService],
  exports: [PathPolicyService],
})
export class CodebasesModule {}
