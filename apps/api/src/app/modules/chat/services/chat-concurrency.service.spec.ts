import { testConfig } from '@codebase-ai/server-testing';
import { ChatConcurrencyService } from './chat-concurrency.service';

describe('ChatConcurrencyService', () => {
  it('refuses beyond the limit until a slot is released', () => {
    const service = new ChatConcurrencyService(
      testConfig({ CHAT_MAX_CONCURRENT: '2' }),
    );

    const first = service.tryAcquire();
    const second = service.tryAcquire();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(service.tryAcquire()).toBeUndefined();

    first?.();
    first?.();
    expect(service.tryAcquire()).toBeDefined();
    expect(service.tryAcquire()).toBeUndefined();
  });
});
