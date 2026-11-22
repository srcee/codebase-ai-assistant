import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { ProjectSyncResponse } from '@codebase-ai/contracts';
import { ProjectSyncService } from '../services/project-sync.service';

@Controller('projects/:id')
export class ProjectSyncController {
  constructor(private readonly projectSync: ProjectSyncService) {}

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  sync(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectSyncResponse> {
    return this.projectSync.sync(id);
  }
}
