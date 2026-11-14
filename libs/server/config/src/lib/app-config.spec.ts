import { delimiter, resolve } from 'node:path';
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
      tokenFile: resolve('.local/api-token.secret'),
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

  it.each(['0.0.0.0', faker.internet.ipv4()])(
    'rejects the non-loopback host %s',
    (host) => {
      expect(() => loadConfig({ API_HOST: host })).toThrow(ConfigError);
    },
  );

  it('resolves the token file against the working directory', () => {
    expect(
      loadConfig({ API_TOKEN_FILE: 'secrets/token.secret' }).api.tokenFile,
    ).toBe(resolve('secrets/token.secret'));
  });

  it('logs at the log level in text format by default', () => {
    expect(loadConfig({}).logging).toEqual({ level: 'log', format: 'text' });
  });

  it('reads the log level and format', () => {
    expect(
      loadConfig({ LOG_LEVEL: 'warn', LOG_FORMAT: 'json' }).logging,
    ).toEqual({ level: 'warn', format: 'json' });
  });

  it.each([
    ['LOG_LEVEL', 'trace'],
    ['LOG_FORMAT', 'xml'],
  ])('rejects an invalid %s', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(ConfigError);
  });

  it.each(['0', '70000', 'abc'])('rejects invalid port %s', (port) => {
    expect(() => loadConfig({ API_PORT: port })).toThrow(ConfigError);
  });

  it('rejects a malformed inference URL', () => {
    expect(() => loadConfig({ INFERENCE_BASE_URL: 'not a url' })).toThrow(
      ConfigError,
    );
  });

  describe('inference', () => {
    it('uses documented defaults', () => {
      expect(loadConfig({}).inference).toEqual({
        provider: 'local',
        runtime: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        embeddingModel: 'nomic-embed-text',
        chatModel: 'qwen2.5-coder:7b',
        embeddingDimensions: 768,
        timeoutMs: 30000,
        maxRetries: 2,
        embeddingBatchSize: 32,
        embeddingQueryPrefix: '',
        embeddingDocumentPrefix: '',
      });
    });

    it('reads the embedding prefixes as written', () => {
      expect(
        loadConfig({
          EMBEDDING_QUERY_PREFIX: 'search_query: ',
          EMBEDDING_DOCUMENT_PREFIX: 'search_document: ',
        }).inference,
      ).toMatchObject({
        embeddingQueryPrefix: 'search_query: ',
        embeddingDocumentPrefix: 'search_document: ',
      });
    });

    it.each([
      ['EMBEDDING_QUERY_PREFIX', 'a'.repeat(101)],
      ['EMBEDDING_DOCUMENT_PREFIX', 'line\nbreak'],
    ])('rejects %s=%j', (key, value) => {
      expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
    });

    it('overrides models and tunables', () => {
      const embeddingModel = faker.lorem.word();
      const chatModel = faker.lorem.word();
      const inference = loadConfig({
        EMBEDDING_MODEL: embeddingModel,
        CHAT_MODEL: chatModel,
        INFERENCE_TIMEOUT_MS: '5000',
        INFERENCE_MAX_RETRIES: '0',
        EMBEDDING_BATCH_SIZE: '8',
      }).inference;
      expect(inference).toMatchObject({
        embeddingModel,
        chatModel,
        timeoutMs: 5000,
        maxRetries: 0,
        embeddingBatchSize: 8,
      });
    });

    it.each(['openai', 'remote', 'Local'])(
      'rejects provider %s',
      (provider) => {
        expect(() => loadConfig({ INFERENCE_PROVIDER: provider })).toThrow(
          ConfigError,
        );
      },
    );

    it.each(['openai', 'llamacpp', 'Ollama'])(
      'rejects unknown runtime %s',
      (runtime) => {
        expect(() => loadConfig({ INFERENCE_RUNTIME: runtime })).toThrow(
          ConfigError,
        );
      },
    );

    it.each([
      ['INFERENCE_TIMEOUT_MS', '10'],
      ['INFERENCE_TIMEOUT_MS', '9999999'],
      ['INFERENCE_MAX_RETRIES', '-1'],
      ['INFERENCE_MAX_RETRIES', '6'],
      ['EMBEDDING_BATCH_SIZE', '0'],
      ['EMBEDDING_BATCH_SIZE', '257'],
    ])('rejects %s=%s', (key, value) => {
      expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
    });
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

  describe('database', () => {
    it('uses documented defaults', () => {
      expect(loadConfig({}).database).toEqual({
        poolMax: 10,
        idleTimeoutMs: 10000,
        statementTimeoutMs: 30000,
      });
    });

    it('reads overrides', () => {
      expect(
        loadConfig({
          DATABASE_POOL_MAX: '20',
          DATABASE_IDLE_TIMEOUT_MS: '5000',
          DATABASE_STATEMENT_TIMEOUT_MS: '1500',
        }).database,
      ).toEqual({
        poolMax: 20,
        idleTimeoutMs: 5000,
        statementTimeoutMs: 1500,
      });
    });

    it.each([
      ['DATABASE_POOL_MAX', '0'],
      ['DATABASE_POOL_MAX', '101'],
      ['DATABASE_IDLE_TIMEOUT_MS', '999'],
      ['DATABASE_STATEMENT_TIMEOUT_MS', '0'],
      ['DATABASE_STATEMENT_TIMEOUT_MS', '600001'],
      ['DATABASE_STATEMENT_TIMEOUT_MS', 'abc'],
    ])('rejects %s=%s', (key, value) => {
      expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
    });

    it('requires the pool to be larger than the indexing concurrency', () => {
      expect(() =>
        loadConfig({
          DATABASE_POOL_MAX: '4',
          INDEXING_EMBED_CONCURRENCY: '4',
        }),
      ).toThrow(ConfigError);
      expect(
        loadConfig({
          DATABASE_POOL_MAX: '5',
          INDEXING_EMBED_CONCURRENCY: '4',
        }).database.poolMax,
      ).toBe(5);
    });
  });

  describe('retrieval', () => {
    it('uses documented defaults', () => {
      expect(loadConfig({}).retrieval).toEqual({
        candidateLimit: 40,
        maxChunks: 8,
        maxContextChars: 12000,
        rrfK: 60,
        hnswEfSearch: 100,
        debugEndpoint: false,
      });
    });

    it('enables the debug endpoint only for the exact value true', () => {
      expect(
        loadConfig({ RETRIEVAL_DEBUG_ENDPOINT: 'true' }).retrieval
          .debugEndpoint,
      ).toBe(true);
      expect(() => loadConfig({ RETRIEVAL_DEBUG_ENDPOINT: '1' })).toThrow(
        ConfigError,
      );
    });

    it.each([
      ['RETRIEVAL_CANDIDATE_LIMIT', '0'],
      ['RETRIEVAL_CANDIDATE_LIMIT', '201'],
      ['RETRIEVAL_MAX_CHUNKS', '0'],
      ['RETRIEVAL_MAX_CHUNKS', '51'],
      ['RETRIEVAL_RRF_K', '0'],
      ['RETRIEVAL_HNSW_EF_SEARCH', '1001'],
      ['RETRIEVAL_MAX_CONTEXT_CHARS', '100'],
    ])('rejects %s=%s', (key, value) => {
      expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
    });

    it('requires the candidate limit to cover the result size', () => {
      expect(() =>
        loadConfig({
          RETRIEVAL_CANDIDATE_LIMIT: '5',
          RETRIEVAL_MAX_CHUNKS: '6',
        }),
      ).toThrow(ConfigError);
    });

    it('requires the context budget to hold one full chunk', () => {
      expect(() =>
        loadConfig({
          CHUNK_MAX_CHARS: '5000',
          RETRIEVAL_MAX_CONTEXT_CHARS: '4000',
        }),
      ).toThrow(ConfigError);
    });
  });

  describe('chat', () => {
    it('uses documented defaults and keeps conversations by default', () => {
      expect(loadConfig({}).chat).toEqual({
        maxQuestionChars: 4000,
        historyTurns: 4,
        historyMaxChars: 4000,
        maxConcurrent: 1,
        generationTimeoutMs: 120000,
        minVectorSimilarity: 0.5,
        retentionDays: undefined,
      });
    });

    it('reads overrides', () => {
      expect(
        loadConfig({
          CHAT_MAX_CONCURRENT: '2',
          CHAT_MIN_VECTOR_SIMILARITY: '0.35',
          CHAT_RETENTION_DAYS: '30',
        }).chat,
      ).toMatchObject({
        maxConcurrent: 2,
        minVectorSimilarity: 0.35,
        retentionDays: 30,
      });
    });

    it.each([
      ['CHAT_MAX_QUESTION_CHARS', '99'],
      ['CHAT_HISTORY_TURNS', '21'],
      ['CHAT_MAX_CONCURRENT', '0'],
      ['CHAT_MAX_CONCURRENT', '5'],
      ['CHAT_GENERATION_TIMEOUT_MS', '10'],
      ['CHAT_MIN_VECTOR_SIMILARITY', '1.5'],
      ['CHAT_RETENTION_DAYS', '0'],
    ])('rejects %s=%s', (key, value) => {
      expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
    });
  });

  describe('indexing', () => {
    it('defaults to an embedding concurrency of 2', () => {
      expect(loadConfig({}).indexing).toEqual({ embedConcurrency: 2 });
    });

    it.each(['0', '9', 'abc'])('rejects concurrency %s', (value) => {
      expect(() => loadConfig({ INDEXING_EMBED_CONCURRENCY: value })).toThrow(
        ConfigError,
      );
    });
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
