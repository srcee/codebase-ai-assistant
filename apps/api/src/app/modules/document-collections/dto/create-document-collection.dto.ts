import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import type { DocumentOrigin } from '@codebase-ai/contracts';

const MAX_PATH_LENGTH = 4096;

export class CreateDocumentCollectionDto {
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

  @IsIn(['folder', 'upload'])
  origin!: DocumentOrigin;

  @ValidateBy({
    name: 'pathMatchesOrigin',
    validator: {
      validate: (value: unknown, args) =>
        (args?.object as CreateDocumentCollectionDto).origin === 'folder'
          ? typeof value === 'string' &&
            value.length > 0 &&
            value.length <= MAX_PATH_LENGTH
          : value === undefined,
      defaultMessage: () =>
        'path is required for folder collections and not allowed for upload collections',
    },
  })
  path?: string;
}
