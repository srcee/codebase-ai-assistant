export type PathRejectionReason =
  | 'invalid-path'
  | 'not-found'
  | 'outside-allowed-roots'
  | 'not-a-directory'
  | 'not-a-git-repository';
