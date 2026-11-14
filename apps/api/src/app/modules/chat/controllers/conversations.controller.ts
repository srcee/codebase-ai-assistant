import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import type {
  ConversationResponse,
  ConversationSummary,
  Page,
} from '@codebase-ai/contracts';
import { PageQueryDto } from '../dto/page-query.dto';
import { ConversationsService } from '../services/conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@Query() query: PageQueryDto): Promise<Page<ConversationSummary>> {
    return this.conversations.list(query);
  }

  @Get(':id')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
  ): Promise<ConversationResponse> {
    return this.conversations.get(id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.conversations.remove(id);
  }
}
