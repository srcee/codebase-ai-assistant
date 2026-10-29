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
  IndexJobResponse,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { IndexJobRunnerService } from '../services/index-job-runner.service';
import { IndexJobsService } from '../services/index-jobs.service';

@Controller('codebases/:id')
export class IndexJobsController {
  constructor(
    private readonly runner: IndexJobRunnerService,
    private readonly jobs: IndexJobsService,
  ) {}

  @Post('index')
  @HttpCode(HttpStatus.ACCEPTED)
  start(@Param('id', ParseUUIDPipe) id: string): Promise<IndexJobResponse> {
    return this.runner.start(id);
  }

  @Get('index-jobs/latest')
  latest(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LatestIndexJobResponse> {
    return this.jobs.latest(id);
  }
}
