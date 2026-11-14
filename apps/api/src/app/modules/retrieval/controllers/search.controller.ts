import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { SearchResponse } from '@codebase-ai/contracts';
import { SearchRequestDto } from '../dto/search-request.dto';
import { RetrievalDebugEnabledGuard } from '../guards/retrieval-debug-enabled.guard';
import { toSearchResult } from '../mappers/search-result.mapper';
import { RetrievalService } from '../services/retrieval.service';
import { SearchScopeService } from '../services/search-scope.service';

/** Debug route for inspecting retrieval; it may be removed once chat uses the service. */
@Controller('search')
@UseGuards(RetrievalDebugEnabledGuard)
export class SearchController {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly scope: SearchScopeService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async search(@Body() body: SearchRequestDto): Promise<SearchResponse> {
    const sourceIds = await this.scope.resolve(body);
    const results = await this.retrieval.search({
      query: body.query,
      sourceIds,
    });
    return { results: results.map(toSearchResult) };
  }
}
