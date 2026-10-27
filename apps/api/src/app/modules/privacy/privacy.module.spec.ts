import { Test } from '@nestjs/testing';
import { APP_CONFIG } from '@codebase-ai/server-config';
import { testConfig, urlWithCredentials } from '@codebase-ai/server-testing';
import { createTestApp } from '../../../testing/create-test-app';
import { PrivacyPolicyError } from './errors/privacy-policy.error';
import { PrivacyModule } from './privacy.module';
import { EgressHttpClient } from './services/egress-http-client.service';

describe('PrivacyModule startup', () => {
  it.each([
    'http://example.com:11434',
    urlWithCredentials('http://127.0.0.1:11434'),
    'http://127.0.0.1:11434/path',
    'https://127.0.0.1:11434',
  ])('fails closed for INFERENCE_BASE_URL=%s', async (url) => {
    await expect(
      createTestApp({ config: testConfig({ INFERENCE_BASE_URL: url }) }),
    ).rejects.toThrow(PrivacyPolicyError);
  });

  it('starts with a loopback URL and exposes the egress client', async () => {
    const module = await Test.createTestingModule({ imports: [PrivacyModule] })
      .useMocker((token) => (token === APP_CONFIG ? testConfig() : undefined))
      .compile();
    expect(module.get(EgressHttpClient)).toBeInstanceOf(EgressHttpClient);
  });
});
