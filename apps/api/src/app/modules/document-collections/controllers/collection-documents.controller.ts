import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { UploadDocumentsResponse } from '@codebase-ai/contracts';
import { DocumentUploadsService } from '../services/document-uploads.service';
import type { UploadRequest } from '../types/upload-request';

@Controller('document-collections/:id/documents')
export class CollectionDocumentsController {
  constructor(private readonly uploads: DocumentUploadsService) {}

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
