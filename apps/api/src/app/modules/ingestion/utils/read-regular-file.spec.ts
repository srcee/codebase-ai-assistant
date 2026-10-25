import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegularFile } from './read-regular-file';
import { createSandbox } from '@codebase-ai/server-testing';

describe('readRegularFile', () => {
  const box = createSandbox('caa-read-file-');
  const file = join(box.path, 'a.txt');
  const directory = join(box.path, 'dir');

  beforeAll(() => {
    writeFileSync(file, 'abcdef');
    mkdirSync(directory);
  });

  afterAll(() => box.dispose());

  it('reads a file within the limit, including one exactly at the limit', async () => {
    const outcome = await readRegularFile(file, 6);
    expect(outcome.kind).toBe('read');
    expect(
      outcome.kind === 'read' && Buffer.from(outcome.bytes).toString(),
    ).toBe('abcdef');
  });

  it('reports a file above the limit without reading it', async () => {
    expect(await readRegularFile(file, 5)).toEqual({ kind: 'too-large' });
  });

  it('rejects directories and missing paths', async () => {
    expect(await readRegularFile(directory, 100)).toEqual({
      kind: 'unreadable',
    });
    expect(await readRegularFile(join(box.path, 'missing'), 100)).toEqual({
      kind: 'unreadable',
    });
  });

  it('reads an empty file', async () => {
    const empty = join(box.path, 'empty.txt');
    writeFileSync(empty, '');
    expect(await readRegularFile(empty, 10)).toEqual({
      kind: 'read',
      bytes: new Uint8Array(),
    });
  });
});
