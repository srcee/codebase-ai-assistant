import { delimiter } from 'node:path';
import {
  assertNotLeaked,
  CANARY_DB_PASSWORD,
  faker,
} from '@codebase-ai/shared-testing';
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
    expect(config.requireGitDirectory).toBe(true);
  });

  it('allows disabling the .git directory requirement', () => {
    expect(
      loadConfig({ REPO_REQUIRE_GIT_DIR: 'false' }).requireGitDirectory,
    ).toBe(false);
    expect(() => loadConfig({ REPO_REQUIRE_GIT_DIR: 'maybe' })).toThrow(
      ConfigError,
    );
  });

  it('ignores empty-string values', () => {
    expect(loadConfig({ API_PORT: '' }).api.port).toBe(3000);
  });

  it('parses allowed roots using the platform delimiter', () => {
    const roots = [faker.system.directoryPath(), faker.system.directoryPath()];
    const config = loadConfig({
      ALLOWED_REPO_ROOTS: roots.join(delimiter),
    });
    expect(config.allowedRepoRoots).toEqual(roots);
  });

  it('rejects a non-loopback host without explicit opt-in', () => {
    expect(() => loadConfig({ API_HOST: '0.0.0.0' })).toThrow(ConfigError);
  });

  it('accepts a non-loopback host with explicit opt-in', () => {
    const host = faker.internet.ipv4();
    const config = loadConfig({
      API_HOST: host,
      API_ALLOW_NON_LOOPBACK: 'true',
    });
    expect(config.api.host).toBe(host);
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
    const failure = (): unknown => {
      try {
        loadConfig({ DATABASE_URL: CANARY_DB_PASSWORD });
      } catch (error) {
        return error;
      }
      return undefined;
    };
    const error = failure();
    expect(error).toBeInstanceOf(ConfigError);
    assertNotLeaked((error as Error).message, CANARY_DB_PASSWORD);
  });
});
