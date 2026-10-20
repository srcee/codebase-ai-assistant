import { delimiter } from 'node:path';
import { ConfigError, loadConfig } from './app-config';

describe('loadConfig', () => {
  it('uses loopback defaults with an empty env', () => {
    const config = loadConfig({});
    expect(config.api).toEqual({
      host: '127.0.0.1',
      port: 3000,
      allowNonLoopback: false,
    });
    expect(config.allowedRepoRoots).toEqual([]);
  });

  it('ignores empty-string values', () => {
    expect(loadConfig({ API_PORT: '' }).api.port).toBe(3000);
  });

  it('parses allowed roots using the platform delimiter', () => {
    const config = loadConfig({
      ALLOWED_REPO_ROOTS: ['/a', '/b'].join(delimiter),
    });
    expect(config.allowedRepoRoots).toEqual(['/a', '/b']);
  });

  it('rejects a non-loopback host without explicit opt-in', () => {
    expect(() => loadConfig({ API_HOST: '0.0.0.0' })).toThrow(ConfigError);
  });

  it('accepts a non-loopback host with explicit opt-in', () => {
    const config = loadConfig({
      API_HOST: '0.0.0.0',
      API_ALLOW_NON_LOOPBACK: 'true',
    });
    expect(config.api.host).toBe('0.0.0.0');
  });

  it.each(['0', '70000', 'abc'])('rejects invalid port %s', (port) => {
    expect(() => loadConfig({ API_PORT: port })).toThrow(ConfigError);
  });

  it('rejects a malformed inference URL', () => {
    expect(() => loadConfig({ INFERENCE_BASE_URL: 'not a url' })).toThrow(
      ConfigError,
    );
  });

  it('does not leak values in error messages', () => {
    const secret = 'postgres-password-canary';
    expect.assertions(2);
    try {
      loadConfig({ DATABASE_URL: secret });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
