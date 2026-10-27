import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import { buildEmbeddingVectors } from '../factories/embedding-vectors';

// Mirrors the Ollama wire types in the app; the adapter specs catch drift.
export interface OllamaEmbedWire {
  embeddings: number[][];
}

export interface OllamaTagsWire {
  models: { name: string; model: string }[];
}

export interface OllamaChatWire {
  message: { role: 'assistant'; content: string };
  done: boolean;
}

interface EmbedTransient {
  count: number;
  dimensions: number;
}

export const ollamaEmbedResponseFactory = Factory.define<
  OllamaEmbedWire,
  EmbedTransient
>(({ transientParams }) => {
  const { count = 1, dimensions = 768 } = transientParams;
  return { embeddings: buildEmbeddingVectors(count, dimensions) };
});

export const ollamaTagsResponseFactory = Factory.define<
  OllamaTagsWire,
  { names: string[] }
>(({ transientParams }) => ({
  models: (transientParams.names ?? []).map((name) => ({ name, model: name })),
}));

class OllamaChatChunkFactory extends Factory<OllamaChatWire> {
  final() {
    return this.params({ message: { content: '' }, done: true });
  }
}

export const ollamaChatChunkFactory = OllamaChatChunkFactory.define(
  (): OllamaChatWire => ({
    message: { role: 'assistant', content: faker.lorem.word() },
    done: false,
  }),
);
