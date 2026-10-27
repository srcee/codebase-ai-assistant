import { Test } from '@nestjs/testing';
import { APP_CONFIG, INFERENCE_RUNTIMES } from '@codebase-ai/server-config';
import { testConfig } from '@codebase-ai/server-testing';
import { RUNTIME_ADAPTERS } from './constants/runtime-adapters';
import { InferenceModule } from './inference.module';
import { CHAT_PORT } from './types/chat-port';
import { EMBEDDING_PORT } from './types/embedding-port';
import { RUNTIME_HEALTH_PORT } from './types/runtime-health-port';

describe('InferenceModule', () => {
  it.each(INFERENCE_RUNTIMES)(
    'plugs the %s adapter into every port as one instance',
    async (runtime) => {
      const module = await Test.createTestingModule({
        imports: [InferenceModule],
      })
        .useMocker((token) =>
          token === APP_CONFIG
            ? testConfig({ INFERENCE_RUNTIME: runtime })
            : undefined,
        )
        .compile();

      const embedding = module.get(EMBEDDING_PORT);
      expect(embedding).toBeInstanceOf(RUNTIME_ADAPTERS[runtime]);
      expect(module.get(CHAT_PORT)).toBe(embedding);
      expect(module.get(RUNTIME_HEALTH_PORT)).toBe(embedding);
    },
  );
});
