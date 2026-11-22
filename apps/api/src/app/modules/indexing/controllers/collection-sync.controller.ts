import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type {
  DocumentChangesResponse,
  IndexJobResponse,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { IndexJobRunnerService } from '../services/index-job-runner.service';
import { IndexJobsService } from '../services/index-jobs.service';
import { SourceChangesService } from '../services/source-changes.service';

@Controller('document-collections/:id')
export class CollectionSyncController {
  constructor(
    private readonly runner: IndexJobRunnerService,
    private readonly jobs: IndexJobsService,
    private readonly changes: SourceChangesService,
  ) {}

  /** "Pull latest": re-indexes new and changed files and drops removed ones. */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  sync(@Param('id', ParseUUIDPipe) id: string): Promise<IndexJobResponse> {
    return this.runner.start(id, 'document_collection');
  }

  @Get('changes')
  pending(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentChangesResponse> {
    return this.changes.changes(id);
  }

  @Get('index-jobs/latest')
  latest(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LatestIndexJobResponse> {
    return this.jobs.latest(id, 'document_collection');
  }
}
