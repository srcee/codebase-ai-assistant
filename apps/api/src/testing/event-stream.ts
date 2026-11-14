import type { ChatStreamEvent } from '@codebase-ai/contracts';
import type { Test } from 'supertest';

/** Buffers a text/event-stream body into `response.body` as a string. */
export function bufferEventStream(test: Test): Test {
  return test.buffer(true).parse((response, callback) => {
    // In Node, superagent hands parsers the raw response stream.
    const stream = response as unknown as NodeJS.ReadableStream;
    let text = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => (text += chunk));
    stream.on('end', () => callback(null, text));
  });
}

export function parseEventStream(text: string): ChatStreamEvent[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n');
      const event = lines
        .find((line) => line.startsWith('event: '))
        ?.slice('event: '.length);
      const data = lines
        .find((line) => line.startsWith('data: '))
        ?.slice('data: '.length);
      return { event, data: JSON.parse(data ?? 'null') } as ChatStreamEvent;
    });
}
