import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runInRequestContext } from '../utils/request-context';
import { ALL_ROUTES_PATH } from './restore-request-context.middleware';

const logger = new Logger('Http');

/** The route pattern, never the raw URL, so ids, query strings, and unknown paths stay out of logs. */
function routeOf(request: Request): string {
  const pattern: unknown = request.route?.path;
  return typeof pattern === 'string' && pattern !== `/${ALL_ROUTES_PATH}`
    ? `${request.baseUrl}${pattern}`
    : '<unmatched>';
}

/** Gives every request a fresh id, ignoring any id the client sends, and logs one line when it ends. */
export function requestLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  const started = process.hrtime.bigint();
  response.locals['requestId'] = requestId;
  response.setHeader('X-Request-Id', requestId);

  response.on('finish', () => {
    const durationMs = Math.round(
      Number(process.hrtime.bigint() - started) / 1e6,
    );
    const line = `${request.method} ${routeOf(request)} ${response.statusCode} ${durationMs}ms`;
    const level =
      response.statusCode >= 500
        ? 'error'
        : response.statusCode >= 400
          ? 'warn'
          : 'log';
    // Socket events lose the async context, so the id is set again for this line.
    runInRequestContext(requestId, () => logger[level](line));
  });

  runInRequestContext(requestId, next);
}
