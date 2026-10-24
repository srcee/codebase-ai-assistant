import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { RepositoryResponse } from '@codebase-ai/contracts';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoriesService } from './repositories.service';

@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repositories: RepositoriesService) {}

  @Post()
  create(@Body() body: CreateRepositoryDto): Promise<RepositoryResponse> {
    return this.repositories.register(body);
  }

  @Get()
  list(): Promise<RepositoryResponse[]> {
    return this.repositories.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RepositoryResponse> {
    return this.repositories.get(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.repositories.remove(id);
  }
}
