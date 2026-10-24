import { loadConfig } from '@codebase-ai/server-config';

/** Builds an AppConfig from only the given env values, ignoring the real process environment. */
export function testConfig(env: Record<string, string> = {}) {
  return loadConfig(env as NodeJS.ProcessEnv);
}
