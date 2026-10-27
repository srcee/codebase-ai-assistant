import { urlWithCredentials } from '@codebase-ai/server-testing';
import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { PrivacyPolicyError } from '../errors/privacy-policy.error';
import { validateInferenceBaseUrl } from './validate-inference-base-url';

describe('validateInferenceBaseUrl', () => {
  it.each([
    'http://localhost:11434',
    'http://127.0.0.1:11434',
    'http://127.0.0.1',
    'http://[::1]:11434',
    'http://LOCALHOST:11434/',
  ])('accepts %s', (url) => {
    expect(validateInferenceBaseUrl(url)).toBeInstanceOf(URL);
  });

  it.each([
    ['remote host', 'http://example.com:11434'],
    ['remote IP', 'http://203.0.113.10:11434'],
    ['private network IP', 'http://192.168.1.20:11434'],
    ['unspecified address', 'http://0.0.0.0:11434'],
    ['subdomain lookalike', 'http://localhost.evil.com:11434'],
    ['dns name for loopback', 'http://127.0.0.1.nip.io:11434'],
    ['trailing-dot localhost', 'http://localhost.:11434'],
    ['IPv4-mapped IPv6', 'http://[::ffff:127.0.0.1]:11434'],
    ['userinfo smuggling', 'http://127.0.0.1@evil.com:11434'],
    [
      'userinfo with loopback host',
      urlWithCredentials('http://127.0.0.1:11434'),
    ],
    ['backslash authority trick', 'http://evil.com\\@127.0.0.1:11434'],
    ['backslash path trick', 'http://127.0.0.1\\@evil.com:11434'],
    ['https scheme', 'https://127.0.0.1:11434'],
    ['other scheme', 'ftp://127.0.0.1:11434'],
    ['path', 'http://127.0.0.1:11434/proxy'],
    ['query', 'http://127.0.0.1:11434/?target=evil.com'],
    ['fragment', 'http://127.0.0.1:11434/#x'],
    ['malformed', 'not a url'],
    ['empty', ''],
  ])('rejects %s', (_label, url) => {
    expect(() => validateInferenceBaseUrl(url)).toThrow(PrivacyPolicyError);
  });

  it('does not echo the rejected value', () => {
    expect(() =>
      validateInferenceBaseUrl(
        urlWithCredentials('http://evil.com', CANARY_SECRET),
      ),
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(CANARY_SECRET),
      }),
    );
  });
});
