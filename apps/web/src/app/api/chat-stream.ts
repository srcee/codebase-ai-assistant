import type { ChatRequest, ChatStreamEvent } from '@codebase-ai/contracts';
import { createEventStreamParser } from './event-stream-parser';
import { toApiError } from './http';

/** Calls `onEvent` for each server-sent event; rejects with ApiError before the stream starts. */
export async function streamChat(
  request: ChatRequest,
  signal: AbortSignal,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw await toApiError(response);
  if (!response.body) throw new Error('The answer stream is missing.');

  const parse = createEventStreamParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parse(decoder.decode(value, { stream: true })).forEach(onEvent);
  }
}
