import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { ProjectResponse } from '@codebase-ai/contracts';
import { CreateProjectDto } from '../dto/create-project.dto';
import { ReplaceProjectSourcesDto } from '../dto/replace-project-sources.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ProjectsService } from '../services/projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body() body: CreateProjectDto): Promise<ProjectResponse> {
    return this.projects.create(body);
  }

  @Get()
  list(): Promise<ProjectResponse[]> {
    return this.projects.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectResponse> {
    return this.projects.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.projects.remove(id);
  }

  @Put(':id/sources')
  replaceSources(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceProjectSourcesDto,
  ): Promise<ProjectResponse> {
    return this.projects.replaceSources(id, body.sourceIds);
  }
}
