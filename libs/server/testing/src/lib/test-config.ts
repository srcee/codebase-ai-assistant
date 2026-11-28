import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '@codebase-ai/server-config';

/** A root that never exists, so nothing can be registered unless a test sets roots. */
export const TEST_MISSING_ROOT = join(tmpdir(), 'caa-test-no-roots');

/** Builds an AppConfig from only the given env values, ignoring the real process environment. */
export function testConfig(env: Record<string, string> = {}) {
  // Keeps tests away from the developer's real upload store and home directory.
  return loadConfig({
    DATA_DIR: join(tmpdir(), 'caa-test-data'),
    ALLOWED_REPO_ROOTS: TEST_MISSING_ROOT,
    ALLOWED_DOCUMENT_ROOTS: TEST_MISSING_ROOT,
    ...env,
  } as NodeJS.ProcessEnv);
}
