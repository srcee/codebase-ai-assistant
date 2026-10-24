import { delimiter } from 'node:path';
import { z } from 'zod';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const enabledByDefaultFlag = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_ALLOW_NON_LOOPBACK: booleanFlag,
    DATABASE_URL: z.url().optional(),
    ALLOWED_REPO_ROOTS: z
      .string()
      .default('')
      .transform((value) => value.split(delimiter).filter(Boolean)),
    REPO_REQUIRE_GIT_DIR: enabledByDefaultFlag,
    INFERENCE_BASE_URL: z.url().default('http://127.0.0.1:11434'),
    EMBEDDING_MODEL: z.string().min(1).optional(),
    CHAT_MODEL: z.string().min(1).optional(),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  })
  .superRefine((env, ctx) => {
    if (!env.API_ALLOW_NON_LOOPBACK && !LOOPBACK_HOSTS.has(env.API_HOST)) {
      ctx.addIssue({
        code: 'custom',
        path: ['API_HOST'],
        message:
          'must be a loopback address unless API_ALLOW_NON_LOOPBACK=true',
      });
    }
  });

export interface AppConfig {
  api: { host: string; port: number; allowNonLoopback: boolean };
  databaseUrl?: string;
  allowedRepoRoots: string[];
  requireGitDirectory: boolean;
  inference: {
    baseUrl: string;
    embeddingModel?: string;
    chatModel?: string;
    embeddingDimensions: number;
  };
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
      allowNonLoopback: e.API_ALLOW_NON_LOOPBACK,
    },
    databaseUrl: e.DATABASE_URL,
    allowedRepoRoots: e.ALLOWED_REPO_ROOTS,
    requireGitDirectory: e.REPO_REQUIRE_GIT_DIR,
    inference: {
      baseUrl: e.INFERENCE_BASE_URL,
      embeddingModel: e.EMBEDDING_MODEL,
      chatModel: e.CHAT_MODEL,
      embeddingDimensions: e.EMBEDDING_DIMENSIONS,
    },
  };
}
