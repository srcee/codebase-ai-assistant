import { dirname, join, resolve } from 'node:path';
import type { ParseWorkerEntry } from '../types/parse-worker-entry';

const BUILT_ENTRY = 'parse-worker.js';

/** The built worker sits next to the bundle; from TypeScript sources (Jest) the same entry runs through ts-node. */
export function defaultParseWorkerEntry(
  moduleFile: string = __filename,
): ParseWorkerEntry {
  return moduleFile.endsWith('.ts')
    ? typescriptWorkerEntry(
        resolve(dirname(moduleFile), '../../../../parse-worker.ts'),
      )
    : { filename: join(dirname(moduleFile), BUILT_ENTRY), eval: false };
}

export function typescriptWorkerEntry(source: string): ParseWorkerEntry {
  const project = resolve(__dirname, '../../../../../tsconfig.spec.json');
  return {
    // Runners such as Nx set TS_NODE_* variables for their own config files; the worker uses the spec tsconfig only.
    filename: [
      "for (const key of Object.keys(process.env)) if (key.startsWith('TS_NODE_')) delete process.env[key];",
      `require('ts-node').register({ transpileOnly: true, project: ${JSON.stringify(project)} });`,
      `require(${JSON.stringify(source)});`,
    ].join('\n'),
    eval: true,
  };
}
