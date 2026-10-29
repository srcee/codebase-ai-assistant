import { delimiter, resolve } from 'node:path';
import { z } from 'zod';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Local runtimes with an adapter in the inference module. */
export const INFERENCE_RUNTIMES = ['ollama'] as const;
export type InferenceRuntime = (typeof INFERENCE_RUNTIMES)[number];

const enabledByDefaultFlag = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const commaList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

// Only the shape is checked here; the ingestion module rejects ids it does not know.
const languageList = z
  .string()
  .transform((value) => commaList(value.toLowerCase()))
  .pipe(
    z
      .array(z.string().regex(/^[a-z0-9+#-]{1,32}$/, 'must be language ids'))
      .min(1)
      .max(100),
  )
  .optional();

const envSchema = z
  .object({
    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_TOKEN_FILE: z.string().min(1).default('.local/api-token.secret'),
    DATABASE_URL: z.url().optional(),
    ALLOWED_REPO_ROOTS: z
      .string()
      .default('')
      .transform((value) => value.split(delimiter).filter(Boolean)),
    REPO_REQUIRE_GIT_DIR: enabledByDefaultFlag,
    INFERENCE_BASE_URL: z.url().default('http://127.0.0.1:11434'),
    INFERENCE_PROVIDER: z.enum(['local']).default('local'),
    INFERENCE_RUNTIME: z.enum(INFERENCE_RUNTIMES).default('ollama'),
    EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
    CHAT_MODEL: z.string().min(1).default('qwen2.5-coder:7b'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
    INFERENCE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(600000)
      .default(30000),
    INFERENCE_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(256).default(32),
    INGEST_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .default(512 * 1024),
    INGEST_MAX_TOTAL_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .default(100 * 1024 * 1024),
    INGEST_LANGUAGES: languageList,
    INGEST_EXCLUDE_PATTERNS: z
      .string()
      .default('')
      .transform(commaList)
      .pipe(z.array(z.string().max(256)).max(256)),
    CHUNK_MAX_CHARS: z.coerce.number().int().min(200).max(20000).default(2000),
    CHUNK_OVERLAP_CHARS: z.coerce.number().int().min(0).default(200),
    INDEXING_EMBED_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(8)
      .default(2),
  })
  .superRefine((env, ctx) => {
    if (!LOOPBACK_HOSTS.has(env.API_HOST)) {
      ctx.addIssue({
        code: 'custom',
        path: ['API_HOST'],
        message: 'must be a loopback address',
      });
    }
    if (env.CHUNK_OVERLAP_CHARS >= env.CHUNK_MAX_CHARS) {
      ctx.addIssue({
        code: 'custom',
        path: ['CHUNK_OVERLAP_CHARS'],
        message: 'must be smaller than CHUNK_MAX_CHARS',
      });
    }
    if (env.INGEST_MAX_FILE_BYTES > env.INGEST_MAX_TOTAL_BYTES) {
      ctx.addIssue({
        code: 'custom',
        path: ['INGEST_MAX_FILE_BYTES'],
        message: 'must not exceed INGEST_MAX_TOTAL_BYTES',
      });
    }
  });

export interface AppConfig {
  api: { host: string; port: number; tokenFile: string };
  databaseUrl?: string;
  allowedRepoRoots: string[];
  requireGitDirectory: boolean;
  inference: InferenceConfig;
  ingestion: IngestionConfig;
  indexing: IndexingConfig;
}

export interface InferenceConfig {
  /** Where requests may go; only loopback exists. */
  provider: 'local';
  /** Which runtime answers there; selects the adapter. */
  runtime: InferenceRuntime;
  baseUrl: string;
  embeddingModel: string;
  chatModel: string;
  embeddingDimensions: number;
  timeoutMs: number;
  /** Applies to embeddings only; streaming chat is never retried. */
  maxRetries: number;
  embeddingBatchSize: number;
}

export interface IngestionConfig {
  maxFileBytes: number;
  maxTotalBytes: number;
  /** Language ids to index; undefined means every language the ingestion module knows. */
  languages?: string[];
  excludePatterns: string[];
  chunkMaxChars: number;
  chunkOverlapChars: number;
}

export interface IndexingConfig {
  /** Files embedded in parallel within one index job. */
  embedConcurrency: number;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration: ${issues.join('; ')}`);
    this.name = 'ConfigError';
  }
}

/** Throws ConfigError listing keys and reasons only, never the offending values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const defined = Object.fromEntries(
    Object.entries(env).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  const result = envSchema.safeParse(defined);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map(
        (i) => `${i.path.join('.') || 'config'}: ${i.message}`,
      ),
    );
  }
  const e = result.data;
  return {
    api: {
      host: e.API_HOST,
      port: e.API_PORT,
      tokenFile: resolve(e.API_TOKEN_FILE),
    },
    databaseUrl: e.DATABASE_URL,
    allowedRepoRoots: e.ALLOWED_REPO_ROOTS,
    requireGitDirectory: e.REPO_REQUIRE_GIT_DIR,
    inference: {
      provider: e.INFERENCE_PROVIDER,
      runtime: e.INFERENCE_RUNTIME,
      baseUrl: e.INFERENCE_BASE_URL,
      embeddingModel: e.EMBEDDING_MODEL,
      chatModel: e.CHAT_MODEL,
      embeddingDimensions: e.EMBEDDING_DIMENSIONS,
      timeoutMs: e.INFERENCE_TIMEOUT_MS,
      maxRetries: e.INFERENCE_MAX_RETRIES,
      embeddingBatchSize: e.EMBEDDING_BATCH_SIZE,
    },
    ingestion: {
      maxFileBytes: e.INGEST_MAX_FILE_BYTES,
      maxTotalBytes: e.INGEST_MAX_TOTAL_BYTES,
      languages: e.INGEST_LANGUAGES,
      excludePatterns: e.INGEST_EXCLUDE_PATTERNS,
      chunkMaxChars: e.CHUNK_MAX_CHARS,
      chunkOverlapChars: e.CHUNK_OVERLAP_CHARS,
    },
    indexing: {
      embedConcurrency: e.INDEXING_EMBED_CONCURRENCY,
    },
  };
}
