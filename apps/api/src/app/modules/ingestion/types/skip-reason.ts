export const SKIP_REASONS = [
  'symlink',
  'excluded-path',
  'secret-filename',
  'custom-exclusion',
  'gitignored',
  'unsupported-extension',
  'too-large',
  'total-size-limit',
  'unreadable',
  'binary',
  'invalid-encoding',
  'line-too-long',
  'secret-content',
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];
