import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { CreateDocumentCollectionRequest } from '@codebase-ai/contracts';

export class CreateDocumentCollectionDto
  implements CreateDocumentCollectionRequest
{
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u, {
    message: 'name must not contain control characters',
  })
  name!: string;

  @IsIn(['folder'])
  origin!: 'folder';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  path!: string;
}
