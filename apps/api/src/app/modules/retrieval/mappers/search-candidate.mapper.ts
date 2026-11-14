import type { ContentKind, SourceKind } from '@codebase-ai/contracts';
import type { SearchCandidate } from '../types/search-candidate';
import { locatorSchema } from '../utils/locator-schema';

export interface CandidateRow
  extends Omit<SearchCandidate, 'sourceKind' | 'contentKind' | 'locator'> {
  sourceKind: string;
  contentKind: string;
  locator: unknown;
}

/** CHECK constraints guard the kinds; the locator is parsed so a malformed one fails instead of reaching a prompt. */
export function toSearchCandidate(row: CandidateRow): SearchCandidate {
  return {
    ...row,
    sourceKind: row.sourceKind as SourceKind,
    contentKind: row.contentKind as ContentKind,
    locator: locatorSchema.parse(row.locator),
  };
}
