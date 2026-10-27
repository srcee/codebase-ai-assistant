import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { EgressHttpError } from '../errors/egress-http.error';
import { EgressUnavailableError } from '../errors/egress-unavailable.error';
import type { EgressRequestOptions } from '../types/egress-request-options';
import {
  INFERENCE_ENDPOINT,
  type InferenceEndpoint,
} from '../types/inference-endpoint';

const MAX_STREAM_LINE_CHARS = 1024 * 1024;

/**
 * The only code allowed to open an outbound connection (enforced by lint).
 * It talks to the policy-checked origin, never follows redirects, and logs paths and timings only.
 */
@Injectable()
export class EgressHttpClient {
  private readonly logger = new Logger(EgressHttpClient.name);

  constructor(
    @Inject(INFERENCE_ENDPOINT) private readonly endpoint: InferenceEndpoint,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  getJson<T>(path: string, options: EgressRequestOptions = {}): Promise<T> {
    return this.requestJson<T>('GET', path, undefined, options);
  }

  postJson<T>(
    path: string,
    body: unknown,
    options: EgressRequestOptions = {},
  ): Promise<T> {
    return this.requestJson<T>('POST', path, body, options);
  }

  /** Yields each non-empty, trimmed line of a streamed response; parsing the line format is up to the caller. */
  async *postLines(
    path: string,
    body: unknown,
    options: EgressRequestOptions = {},
  ): AsyncGenerator<string, void, undefined> {
    const controller = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;
    const idleMs = options.timeoutMs ?? this.config.inference.timeoutMs;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, idleMs);
    };

    try {
      arm();
      const response = await this.send('POST', path, body, signal);
      if (!response.body) {
        throw new EgressUnavailableError('invalid-response');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      for (;;) {
        const { done, value } = await reader.read();
        clearTimeout(timer);
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let newline = buffered.indexOf('\n');
        while (newline !== -1) {
          const line = buffered.slice(0, newline).trim();
          buffered = buffered.slice(newline + 1);
          if (line) yield line;
          newline = buffered.indexOf('\n');
        }
        if (buffered.length > MAX_STREAM_LINE_CHARS) {
          throw new EgressUnavailableError('invalid-response');
        }
        arm();
      }
      const rest = (buffered + decoder.decode()).trim();
      if (rest) yield rest;
    } catch (error) {
      throw this.normalizeError(error, timedOut, options.signal);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  private async requestJson<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    options: EgressRequestOptions,
  ): Promise<T> {
    const timeout = AbortSignal.timeout(
      options.timeoutMs ?? this.config.inference.timeoutMs,
    );
    const signal = options.signal
      ? AbortSignal.any([timeout, options.signal])
      : timeout;
    try {
      const response = await this.send(method, path, body, signal);
      return (await response.json()) as T;
    } catch (error) {
      throw this.normalizeError(error, timeout.aborted, options.signal);
    }
  }

  private async send(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<Response> {
    const url = this.resolveUrl(path);
    const started = Date.now();
    const response = await fetch(url, {
      method,
      redirect: 'error',
      headers:
        body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    this.logger.debug(
      `${method} ${path} -> ${response.status} in ${Date.now() - started}ms`,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new EgressHttpError(response.status);
    }
    return response;
  }

  private resolveUrl(path: string): URL {
    const url = new URL(path, this.endpoint.origin);
    if (url.origin !== this.endpoint.origin || !path.startsWith('/')) {
      throw new EgressUnavailableError('blocked');
    }
    return url;
  }

  private normalizeError(
    error: unknown,
    timedOut: boolean,
    callerSignal: AbortSignal | undefined,
  ): unknown {
    if (
      error instanceof EgressHttpError ||
      error instanceof EgressUnavailableError
    ) {
      return error;
    }
    if (callerSignal?.aborted) return error;
    const normalized = new EgressUnavailableError(
      timedOut
        ? 'timeout'
        : isJsonSyntaxError(error)
          ? 'invalid-response'
          : 'network',
    );
    this.logger.warn(`Egress request failed: ${normalized.reason}`);
    return normalized;
  }
}

// Matched by name because errors from undici are not instanceof SyntaxError inside jest's realm.
function isJsonSyntaxError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'SyntaxError';
}
