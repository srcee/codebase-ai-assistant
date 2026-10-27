import { createGitignoreLayer, isGitignored } from './gitignore-layers';

describe('isGitignored', () => {
  const root = createGitignoreLayer('', 'generated/\n*.log\n');
  const nested = createGitignoreLayer('packages/a', 'local.ts\n!keep.log\n');

  it('applies root rules to any depth', () => {
    expect(isGitignored([root], 'generated', true)).toBe(true);
    expect(isGitignored([root], 'a/b/debug.log', false)).toBe(true);
    expect(isGitignored([root], 'src/index.ts', false)).toBe(false);
  });

  it('matches directory-only rules only against directories', () => {
    expect(isGitignored([root], 'generated', false)).toBe(false);
  });

  it('resolves nested rules relative to their own directory', () => {
    const layers = [root, nested];
    expect(isGitignored(layers, 'packages/a/local.ts', false)).toBe(true);
    expect(isGitignored(layers, 'local.ts', false)).toBe(false);
  });

  it('lets a deeper negation override a shallower rule', () => {
    expect(isGitignored([root, nested], 'packages/a/keep.log', false)).toBe(
      false,
    );
  });

  it('ignores nothing without layers', () => {
    expect(isGitignored([], 'a.ts', false)).toBe(false);
  });
});
