const REDACTED_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

export interface LoggedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  durationMs: number;
}

/** Hides credentials so request logs can be shared with support. */
export function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      REDACTED_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value,
    ]),
  );
}

export function logRequest(request: LoggedRequest): string {
  const headers = JSON.stringify(redactHeaders(request.headers));
  return `${request.method} ${request.path} ${request.durationMs}ms ${headers}`;
}
