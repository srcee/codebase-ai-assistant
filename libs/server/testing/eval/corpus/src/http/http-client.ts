import { retryWithBackoff } from './retry-policy';

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  maxAttempts: number;
}

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>('POST', path, body);
  }

  /** Sends the request and retries transient failures with exponential backoff. */
  private send<T>(method: string, path: string, body?: unknown): Promise<T> {
    return retryWithBackoff(
      async () => {
        const response = await this.perform(method, path, body);
        if (response.status >= 500) {
          throw new TransientHttpError(response.status);
        }
        return response.json() as Promise<T>;
      },
      { maxAttempts: this.options.maxAttempts, baseDelayMs: 200 },
    );
  }

  private async perform(method: string, path: string, body?: unknown) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      return await fetch(`${this.options.baseUrl}${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export class TransientHttpError extends Error {
  constructor(readonly status: number) {
    super(`Upstream answered with status ${status}`);
  }
}
