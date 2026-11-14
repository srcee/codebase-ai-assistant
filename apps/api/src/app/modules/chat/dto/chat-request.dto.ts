import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { ChatRequest } from '@codebase-ai/contracts';
import { trimString } from '../../projects/utils/trim-string';

/** The configured question limit is checked by ChatService; the scope by SearchScopeService. */
export class ChatRequestDto implements ChatRequest {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  sourceIds?: string[];

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
