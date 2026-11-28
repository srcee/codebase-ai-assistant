import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '@codebase-ai/server-config';

/** Builds an AppConfig from only the given env values, ignoring the real process environment. */
export function testConfig(env: Record<string, string> = {}) {
  // Keeps tests away from the developer's real upload store.
  return loadConfig({
    DATA_DIR: join(tmpdir(), 'caa-test-data'),
    ...env,
  } as NodeJS.ProcessEnv);
}
