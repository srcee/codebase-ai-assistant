import type { Language } from '../types/language';
import type { ChunkingStrategy } from '../types/language-definition';
import { LANGUAGES } from './languages';

export const LANGUAGE_BY_EXTENSION: ReadonlyMap<string, Language> = new Map(
  LANGUAGES.flatMap((language) =>
    language.extensions.map((extension) => [extension, language.id] as const),
  ),
);

export const LANGUAGE_BY_FILENAME: ReadonlyMap<string, Language> = new Map(
  LANGUAGES.flatMap((language) =>
    ('filenames' in language ? language.filenames : []).map(
      (filename) => [filename, language.id] as const,
    ),
  ),
);

export const CHUNKING_BY_LANGUAGE: ReadonlyMap<Language, ChunkingStrategy> =
  new Map(LANGUAGES.map((language) => [language.id, language.chunking]));

export const KNOWN_LANGUAGE_IDS: ReadonlySet<string> = new Set(
  LANGUAGES.map((language) => language.id),
);
