import { searchTermsFor } from '../../ingestion/utils/identifier-terms';

const STOPWORDS = new Set([
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'did',
  'do',
  'does',
  'how',
  'if',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'the',
  'to',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
]);

const MAX_TERMS = 64;

export interface LexicalQuery {
  /** Lower-case alphanumeric terms joined with `|`, safe for `to_tsquery`. */
  tsquery: string;
  /** The original text, for adjacent-phrase matching with `phraseto_tsquery`. */
  phrase: string;
}

/** Turns free text into an OR query of the terms indexed in `search_terms`; undefined when nothing searchable remains. */
export function buildLexicalQuery(text: string): LexicalQuery | undefined {
  const terms = searchTermsFor(text)
    .split(' ')
    .filter((term) => term !== '' && !STOPWORDS.has(term))
    .slice(0, MAX_TERMS);
  if (terms.length === 0) return undefined;
  return { tsquery: terms.join(' | '), phrase: text };
}
