import { faker } from '@codebase-ai/shared-testing';
import type { ChatMessage } from '../../inference/types/chat-message';
import type { ChatPort } from '../../inference/types/chat-port';
import { GenerationService } from './generation.service';

describe('GenerationService', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: faker.lorem.sentence() },
  ];

  it('delegates completion and streaming to the chat port', async () => {
    const reply = faker.lorem.sentence();
    const fragments = [faker.lorem.word(), faker.lorem.word()];
    const signal = new AbortController().signal;
    const port: ChatPort = {
      complete: jest.fn(async () => reply),
      stream: jest.fn(async function* () {
        yield* fragments;
      }),
    };
    const service = new GenerationService(port);

    await expect(service.complete(messages, { signal })).resolves.toBe(reply);
    const streamed: string[] = [];
    for await (const fragment of service.stream(messages, { signal })) {
      streamed.push(fragment);
    }

    expect(streamed).toEqual(fragments);
    expect(port.complete).toHaveBeenCalledWith(messages, { signal });
    expect(port.stream).toHaveBeenCalledWith(messages, { signal });
  });
});
