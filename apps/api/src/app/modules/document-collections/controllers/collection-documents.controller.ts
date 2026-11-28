import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type {
  DocumentSummary,
  Page,
  UploadDocumentsResponse,
} from '@codebase-ai/contracts';
import { PageQueryDto } from '../../chat/dto/page-query.dto';
import { DocumentUploadsService } from '../services/document-uploads.service';
import type { UploadRequest } from '../types/upload-request';

@Controller('document-collections/:id/documents')
export class CollectionDocumentsController {
  constructor(private readonly uploads: DocumentUploadsService) {}

  @Get()
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
  ): Promise<Page<DocumentSummary>> {
    return this.uploads.list(id, query);
  }

  /** multipart/form-data: a `path` field before each `file` part. */
  @Post()
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: UploadRequest,
  ): Promise<UploadDocumentsResponse> {
    return this.uploads.upload(id, request);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<void> {
    return this.uploads.remove(id, documentId);
  }
}
