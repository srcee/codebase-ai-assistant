import { Test } from '@nestjs/testing';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { EmbeddingsService } from './modules/embeddings/services/embeddings.service';
import { GenerationModule } from './modules/generation/generation.module';
import { GenerationService } from './modules/generation/services/generation.service';

// Opt-in: set RUN_INFERENCE_SMOKE=true with the configured runtime running and its models available.
const smoke =
  process.env['RUN_INFERENCE_SMOKE'] === 'true' ? describe : describe.skip;

smoke('local inference smoke test', () => {
  // Reads INFERENCE_* and model settings from the environment, so any runtime can be checked.
  const config = loadConfig();
  let embeddings: EmbeddingsService;
  let generation: GenerationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [EmbeddingsModule, GenerationModule],
    })
      .useMocker((token) => (token === APP_CONFIG ? config : undefined))
      .compile();
    embeddings = module.get(EmbeddingsService);
    generation = module.get(GenerationService);
  });

  it('embeds text with the configured model', async () => {
    const [vector] = await embeddings.embed(['export const answer = 42;']);
    expect(vector).toHaveLength(config.inference.embeddingDimensions);
  });

  it('completes a chat message with the configured model', async () => {
    const reply = await generation.complete([
      { role: 'user', content: 'Reply with the single word: ok' },
    ]);
    expect(reply.length).toBeGreaterThan(0);
  });
});
