import { Module } from '@nestjs/common';
import { DatabaseModule } from '@codebase-ai/server-database';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectScopeService } from './services/project-scope.service';
import { ProjectsService } from './services/projects.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectScopeService],
  exports: [ProjectScopeService],
})
export class ProjectsModule {}
