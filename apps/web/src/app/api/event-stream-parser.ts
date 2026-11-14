import type { ChatStreamEvent } from '@codebase-ai/contracts';

/** Feeds text chunks in any split and returns the complete events so far. */
export function createEventStreamParser(): (
  chunk: string,
) => ChatStreamEvent[] {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    return blocks.flatMap((block): ChatStreamEvent[] => {
      let event: string | undefined;
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (!event || data.length === 0) return [];
      return [{ event, data: JSON.parse(data.join('\n')) } as ChatStreamEvent];
    });
  };
}
