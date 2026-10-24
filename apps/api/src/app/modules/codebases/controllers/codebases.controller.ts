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
import type { CodebaseResponse } from '@codebase-ai/contracts';
import { CreateCodebaseDto } from '../dto/create-codebase.dto';
import { CodebasesService } from '../services/codebases.service';

@Controller('codebases')
export class CodebasesController {
  constructor(private readonly codebases: CodebasesService) {}

  @Post()
  create(@Body() body: CreateCodebaseDto): Promise<CodebaseResponse> {
    return this.codebases.register(body);
  }

  @Get()
  list(): Promise<CodebaseResponse[]> {
    return this.codebases.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CodebaseResponse> {
    return this.codebases.get(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.codebases.remove(id);
  }
}
