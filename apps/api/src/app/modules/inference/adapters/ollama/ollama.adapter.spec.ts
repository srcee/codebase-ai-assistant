import { testConfig } from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import type { ChatMessage } from '../../types/chat-message';
import { OllamaChat } from './ollama-chat';
import { OllamaEmbedding } from './ollama-embedding';
import { OllamaModels } from './ollama-models';
import { OllamaAdapter } from './ollama.adapter';

describe('OllamaAdapter', () => {
  const config = testConfig();
  const adapter = new OllamaAdapter(
    new EgressHttpClient({ origin: 'http://127.0.0.1:11434' }, config),
    config,
  );
  const signal = new AbortController().signal;
  const messages: ChatMessage[] = [
    { role: 'user', content: faker.lorem.sentence() },
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates embeddings', async () => {
    const vectors = [[faker.number.float()]];
    const embed = jest
      .spyOn(OllamaEmbedding.prototype, 'embedBatch')
      .mockResolvedValue(vectors);

    await expect(adapter.embedBatch(['x'], { signal })).resolves.toBe(vectors);
    expect(embed).toHaveBeenCalledWith(['x'], { signal });
  });

  it('delegates chat completion and streaming', async () => {
    const reply = faker.lorem.sentence();
    const complete = jest
      .spyOn(OllamaChat.prototype, 'complete')
      .mockResolvedValue(reply);
    const stream = jest
      .spyOn(OllamaChat.prototype, 'stream')
      .mockImplementation(async function* () {
        yield reply;
      });

    await expect(adapter.complete(messages, { signal })).resolves.toBe(reply);
    const streamed: string[] = [];
    for await (const fragment of adapter.stream(messages, { signal })) {
      streamed.push(fragment);
    }

    expect(streamed).toEqual([reply]);
    expect(complete).toHaveBeenCalledWith(messages, { signal });
    expect(stream).toHaveBeenCalledWith(messages, { signal });
  });

  it('delegates model availability', async () => {
    const available = jest
      .spyOn(OllamaModels.prototype, 'availableModels')
      .mockResolvedValue([true, false]);

    await expect(adapter.availableModels(['a', 'b'])).resolves.toEqual([
      true,
      false,
    ]);
    expect(available).toHaveBeenCalledWith(['a', 'b']);
  });
});
