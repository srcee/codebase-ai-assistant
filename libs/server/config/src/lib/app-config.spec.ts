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

  describe('ingestion', () => {
    it('uses documented defaults', () => {
      expect(loadConfig({}).ingestion).toEqual({
        maxFileBytes: 512 * 1024,
        maxTotalBytes: 100 * 1024 * 1024,
        languages: undefined,
        excludePatterns: [],
        chunkMaxChars: 2000,
        chunkOverlapChars: 200,
      });
    });

    it('parses, trims and lower-cases lists', () => {
      const config = loadConfig({
        INGEST_LANGUAGES: ' TypeScript, c++ ,c#,',
        INGEST_EXCLUDE_PATTERNS: 'docs/**, *.snap',
      });
      expect(config.ingestion.languages).toEqual(['typescript', 'c++', 'c#']);
      expect(config.ingestion.excludePatterns).toEqual(['docs/**', '*.snap']);
    });

    it.each(['.ts', 'type script', '../x', 'a'.repeat(33)])(
      'rejects language list %s',
      (value) => {
        expect(() => loadConfig({ INGEST_LANGUAGES: value })).toThrow(
          ConfigError,
        );
      },
    );

    it('rejects a list with no languages', () => {
      expect(() => loadConfig({ INGEST_LANGUAGES: ' , ' })).toThrow(
        ConfigError,
      );
    });

    it('rejects an overlap that is not smaller than the chunk size', () => {
      expect(() =>
        loadConfig({ CHUNK_MAX_CHARS: '500', CHUNK_OVERLAP_CHARS: '500' }),
      ).toThrow(ConfigError);
    });

    it('rejects a file limit above the total limit', () => {
      expect(() =>
        loadConfig({
          INGEST_MAX_FILE_BYTES: '4096',
          INGEST_MAX_TOTAL_BYTES: '2048',
        }),
      ).toThrow(ConfigError);
    });

    it.each(['0', '-1', 'abc', '10'])('rejects invalid size %s', (value) => {
      expect(() => loadConfig({ INGEST_MAX_FILE_BYTES: value })).toThrow(
        ConfigError,
      );
    });

    it('does not leak pattern values in error messages', () => {
      expect(() =>
        loadConfig({ INGEST_LANGUAGES: `${CANARY_DB_PASSWORD}!` }),
      ).toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining(CANARY_DB_PASSWORD),
        }),
      );
    });
  });
});
