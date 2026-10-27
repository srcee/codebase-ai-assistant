import { KNOWN_LANGUAGE_IDS } from '../constants/language-lookups';

/** Thrown at startup so a mistyped INGEST_LANGUAGES fails loudly instead of indexing nothing. */
export class UnknownLanguageError extends Error {
  constructor(readonly languages: readonly string[]) {
    super(
      `Unknown language in INGEST_LANGUAGES: ${languages.join(', ')}. Known languages: ${[...KNOWN_LANGUAGE_IDS].join(', ')}.`,
    );
    this.name = 'UnknownLanguageError';
  }
}
