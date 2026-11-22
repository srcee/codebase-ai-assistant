import type { SourceKind } from '@codebase-ai/contracts';

export const SOURCE_NOT_FOUND: Readonly<Record<SourceKind, string>> = {
  code_repository: 'Codebase not found.',
  document_collection: 'Document collection not found.',
};

export const JOB_ALREADY_ACTIVE: Readonly<Record<SourceKind, string>> = {
  code_repository: 'An index job is already active for this codebase.',
  document_collection:
    'A sync job is already active for this document collection.',
};

export const NO_JOB_YET: Readonly<Record<SourceKind, string>> = {
  code_repository: 'No index job for this codebase.',
  document_collection: 'No sync job for this document collection.',
};
