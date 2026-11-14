import { faker } from '@codebase-ai/shared-testing';
import { testConfig } from '@codebase-ai/server-testing';
import { searchCandidateFactory } from '../../../../testing/factories/search-candidate.factory';
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
    const service = new GenerationService(port, testConfig());

    await expect(service.complete(messages, { signal })).resolves.toBe(reply);
    const streamed: string[] = [];
    for await (const fragment of service.stream(messages, { signal })) {
      streamed.push(fragment);
    }

    expect(streamed).toEqual(fragments);
    expect(port.complete).toHaveBeenCalledWith(messages, { signal });
    expect(port.stream).toHaveBeenCalledWith(messages, { signal });
  });

  it('streams a grounded answer from a prompt with system policy and evidence', async () => {
    const port: ChatPort = {
      complete: jest.fn(),
      stream: jest.fn(async function* () {
        yield 'answer';
      }),
    };
    const service = new GenerationService(
      port,
      testConfig({ CHAT_HISTORY_TURNS: '1' }),
    );
    const evidence = searchCandidateFactory.buildList(2);
    const history = [
      { question: faker.lorem.sentence(), answer: faker.lorem.sentence() },
      { question: faker.lorem.sentence(), answer: faker.lorem.sentence() },
    ];
    const signal = new AbortController().signal;

    const streamed: string[] = [];
    for await (const fragment of service.streamGroundedAnswer(
      { question: faker.lorem.sentence(), evidence, history },
      { signal },
    )) {
      streamed.push(fragment);
    }

    expect(streamed).toEqual(['answer']);
    const [sent, options] = jest.mocked(port.stream).mock.calls[0];
    expect(options).toEqual({ signal });
    expect(sent.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(sent[1].content).toBe(history[1].question);
    expect(sent[3].content).toContain(evidence[1].content);
  });
});
