import type { ChatStreamEvent } from '@codebase-ai/contracts';
import type { Response } from 'express';

export function startEventStream(response: Response): void {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();
}

/** JSON keeps each payload on one `data:` line. */
export function writeEvent(response: Response, event: ChatStreamEvent): void {
  response.write(
    `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
  );
}
