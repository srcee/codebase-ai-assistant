import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import type { ReplaceProjectSourcesRequest } from '@codebase-ai/contracts';
import { lowerCaseEach } from '../utils/lower-case-each';

export class ReplaceProjectSourcesDto implements ReplaceProjectSourcesRequest {
  @Transform(lowerCaseEach)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  sourceIds!: string[];
}
