export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Runs the operation again after each failure, doubling the wait and adding random jitter. */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await sleep(backoffDelay(attempt, options.baseDelayMs));
    }
  }
  throw new Error('Retry attempts exhausted', { cause: lastError });
}

export function backoffDelay(attempt: number, baseDelayMs: number): number {
  const jitter = Math.random() * baseDelayMs;
  return baseDelayMs * 2 ** attempt + jitter;
}
