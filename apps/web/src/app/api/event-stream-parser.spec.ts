import { chatDoneEventFactory } from '@codebase-ai/shared-testing';
import { createEventStreamParser } from './event-stream-parser';

describe('createEventStreamParser', () => {
  it('returns events split across chunks once they are complete', () => {
    const parse = createEventStreamParser();
    const done = chatDoneEventFactory.build();
    const text = `event: token\ndata: {"text":"Hel"}\n\nevent: done\ndata: ${JSON.stringify(done)}\n\n`;
    const cut = text.indexOf('done') + 2;

    expect(parse(text.slice(0, 5))).toEqual([]);
    expect(parse(text.slice(5, cut))).toEqual([
      { event: 'token', data: { text: 'Hel' } },
    ]);
    expect(parse(text.slice(cut))).toEqual([{ event: 'done', data: done }]);
  });

  it('accepts CRLF line endings and skips blocks without data', () => {
    const parse = createEventStreamParser();
    expect(
      parse(': comment\r\n\r\nevent: token\r\ndata: {"text":"a"}\r\n\r\n'),
    ).toEqual([{ event: 'token', data: { text: 'a' } }]);
  });
});
