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
import type { DocumentCollectionResponse } from '@codebase-ai/contracts';
import { CreateDocumentCollectionDto } from '../dto/create-document-collection.dto';
import { DocumentCollectionsService } from '../services/document-collections.service';

@Controller('document-collections')
export class DocumentCollectionsController {
  constructor(private readonly collections: DocumentCollectionsService) {}

  @Post()
  create(
    @Body() body: CreateDocumentCollectionDto,
  ): Promise<DocumentCollectionResponse> {
    return this.collections.register(body);
  }

  @Get()
  list(): Promise<DocumentCollectionResponse[]> {
    return this.collections.list();
  }

  @Get(':id')
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentCollectionResponse> {
    return this.collections.get(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.collections.remove(id);
  }
}
