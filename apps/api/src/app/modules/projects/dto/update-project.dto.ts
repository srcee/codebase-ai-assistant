import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { UpdateProjectRequest } from '@codebase-ai/contracts';
import { trimString } from '../utils/trim-string';

export class UpdateProjectDto implements UpdateProjectRequest {
  // Unlike IsOptional, this still rejects an explicit null name.
  @ValidateIf((body: UpdateProjectDto) => body.name !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u, {
    message: 'name must not contain control characters',
  })
  name?: string;

  /** null clears the description. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
