import { join } from 'node:path';
import {
  defaultParseWorkerEntry,
  typescriptWorkerEntry,
} from './default-parse-worker-entry';

describe('defaultParseWorkerEntry', () => {
  it('starts the built worker next to the bundle', () => {
    const bundle = join('dist', 'apps', 'api', 'main.js');
    expect(defaultParseWorkerEntry(bundle)).toEqual({
      filename: join('dist', 'apps', 'api', 'parse-worker.js'),
      eval: false,
    });
  });

  it('runs the TypeScript entry through ts-node from sources', () => {
    const entry = defaultParseWorkerEntry();
    expect(entry.eval).toBe(true);
    expect(entry.filename).toContain("require('ts-node').register");
    expect(entry.filename).toContain(
      JSON.stringify(
        join(__dirname, '..', '..', '..', '..', 'parse-worker.ts'),
      ),
    );
  });

  it('loads any TypeScript worker the same way', () => {
    const source = join(__dirname, 'fixture-worker.ts');
    expect(typescriptWorkerEntry(source).filename).toContain(
      JSON.stringify(source),
    );
  });
});
