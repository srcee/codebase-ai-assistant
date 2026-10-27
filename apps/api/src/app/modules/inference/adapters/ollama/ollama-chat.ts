import type { AppConfig } from '@codebase-ai/server-config';
import type { EgressHttpClient } from '../../../privacy/services/egress-http-client.service';
import { InferenceUnavailableError } from '../../errors/inference-unavailable.error';
import type { ChatMessage } from '../../types/chat-message';
import type { ChatPort } from '../../types/chat-port';
import type { InferenceRequestOptions } from '../../types/inference-request-options';
import { toInferenceError } from '../../utils/to-inference-error';
import type {
  OllamaChatRequest,
  OllamaChatResponse,
} from './ollama-wire.types';

const CHAT_PATH = '/api/chat';

/** Streams as newline-delimited JSON: one response object per line. */
export class OllamaChat implements ChatPort {
  constructor(
    private readonly egress: EgressHttpClient,
    private readonly config: AppConfig,
  ) {}

  async complete(
    messages: readonly ChatMessage[],
    options: InferenceRequestOptions = {},
  ): Promise<string> {
    try {
      const response = await this.egress.postJson<OllamaChatResponse>(
        CHAT_PATH,
        this.request(messages, false),
        { signal: options.signal },
      );
      return contentOf(response);
    } catch (error) {
      throw toInferenceError(error, this.config.inference.chatModel);
    }
  }

  async *stream(
    messages: readonly ChatMessage[],
    options: InferenceRequestOptions = {},
  ): AsyncGenerator<string, void, undefined> {
    try {
      for await (const line of this.egress.postLines(
        CHAT_PATH,
        this.request(messages, true),
        { signal: options.signal },
      )) {
        const content = contentOf(parseLine(line));
        if (content) yield content;
      }
    } catch (error) {
      throw toInferenceError(error, this.config.inference.chatModel);
    }
  }

  private request(
    messages: readonly ChatMessage[],
    stream: boolean,
  ): OllamaChatRequest {
    return { model: this.config.inference.chatModel, messages, stream };
  }
}

function parseLine(line: string): OllamaChatResponse {
  try {
    return JSON.parse(line) as OllamaChatResponse;
  } catch {
    throw new InferenceUnavailableError('invalid-response');
  }
}

function contentOf(response: OllamaChatResponse): string {
  if (!response || typeof response !== 'object' || response.error) {
    throw new InferenceUnavailableError('invalid-response');
  }
  const content = response.message?.content;
  if (content !== undefined && typeof content !== 'string') {
    throw new InferenceUnavailableError('invalid-response');
  }
  return content ?? '';
}
