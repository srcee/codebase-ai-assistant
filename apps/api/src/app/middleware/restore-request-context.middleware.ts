import type { NextFunction, Request, Response } from 'express';
import { runInRequestContext } from '../utils/request-context';

/** The catch-all route this middleware is mounted on; Express reports it as the route of unmatched requests. */
export const ALL_ROUTES_PATH = '{*path}';

/** Registered after body parsing, which drops the async context that the logging middleware set. */
export function restoreRequestContextMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId: unknown = response.locals['requestId'];
  if (typeof requestId === 'string') runInRequestContext(requestId, next);
  else next();
}
