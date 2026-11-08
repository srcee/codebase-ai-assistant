const QUERY_CANCELED = '57014';
const MAX_CAUSE_DEPTH = 5;

/** Also matches when the driver wraps the Postgres error as the cause. */
export function isStatementTimeoutError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object' || current === null) return false;
    const { code, message, cause } = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (
      code === QUERY_CANCELED &&
      typeof message === 'string' &&
      message.includes('statement timeout')
    ) {
      return true;
    }
    current = cause;
  }
  return false;
}
