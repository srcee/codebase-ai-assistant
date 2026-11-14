import type { ChatStreamEvent } from '@codebase-ai/contracts';
import { healthResponseFactory } from '@codebase-ai/shared-testing';
import { vi } from 'vitest';

type Handler = (init: RequestInit | undefined, url: string) => Response;

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const encode = (event: ChatStreamEvent): Uint8Array =>
  new TextEncoder().encode(
    `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
  );

/** Sends the events, then closes; with `holdUntil` it stays open and fails when that signal aborts. */
export function eventStream(
  events: ChatStreamEvent[],
  holdUntil?: AbortSignal,
): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      events.forEach((event) => controller.enqueue(encode(event)));
      if (!holdUntil) {
        controller.close();
        return;
      }
      holdUntil.addEventListener('abort', () =>
        controller.error(new DOMException('Aborted', 'AbortError')),
      );
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** Routes are `METHOD /path`; a trailing `*` matches any rest of the path. */
export function mockApi(routes: Record<string, Handler>) {
  const all: Record<string, Handler> = {
    'GET /health': () => json(200, healthResponseFactory.build()),
    'GET /projects': () => json(200, []),
    'GET /codebases': () => json(200, []),
    'GET /conversations': () => json(200, { items: [], nextCursor: null }),
    ...routes,
  };
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const path = url.replace(/^\/api/, '').split('?')[0];
      const match = Object.keys(all).find((key) => {
        const [routeMethod, routePath] = key.split(' ');
        return (
          routeMethod === method &&
          (routePath === path ||
            (routePath.endsWith('*') &&
              path.startsWith(routePath.slice(0, -1))))
        );
      });
      return match
        ? all[match](init, url)
        : json(404, { message: 'Not found' });
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
