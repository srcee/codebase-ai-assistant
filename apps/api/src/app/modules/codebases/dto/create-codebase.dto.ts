import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { CreateCodebaseRequest } from '@codebase-ai/contracts';

export class CreateCodebaseDto implements CreateCodebaseRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  path!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u, {
    message: 'name must not contain control characters',
  })
  name?: string;
}
