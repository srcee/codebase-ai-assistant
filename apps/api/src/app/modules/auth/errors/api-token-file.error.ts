/** The message names the setting only; it never carries the token or its path contents. */
export class ApiTokenFileError extends Error {
  constructor(reason: 'malformed' | 'permissions' | 'unreadable') {
    super(`API token file is unusable (${reason}); check API_TOKEN_FILE`);
    this.name = 'ApiTokenFileError';
  }
}
