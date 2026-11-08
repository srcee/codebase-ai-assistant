import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSandbox } from '@codebase-ai/server-testing';
import { evalRoot } from './eval-root';

describe('evalRoot', () => {
  it('finds the eval folder from the workspace root marker', () => {
    const box = createSandbox('caa-eval-root-');
    try {
      const nested = join(box.root, 'a', 'b');
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(box.root, 'nx.json'), '{}');

      expect(evalRoot(nested)).toBe(
        join(box.root, 'libs', 'server', 'testing', 'eval'),
      );
    } finally {
      box.dispose();
    }
  });

  it('finds this workspace', () => {
    expect(evalRoot()).toMatch(/testing[\\/]eval$/);
  });

  it('fails when no workspace root exists above the start', () => {
    const box = createSandbox('caa-eval-root-');
    try {
      expect(() => evalRoot(box.root)).toThrow('Workspace root not found');
    } finally {
      box.dispose();
    }
  });
});
