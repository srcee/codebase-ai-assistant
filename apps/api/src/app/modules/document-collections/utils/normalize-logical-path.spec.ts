import { faker } from '@codebase-ai/shared-testing';
import { normalizeLogicalPath } from './normalize-logical-path';

describe('normalizeLogicalPath', () => {
  const name = () => `${faker.word.noun()}.md`;

  it('keeps a nested relative path', () => {
    const path = `specs/${faker.word.noun()}/${name()}`;
    expect(normalizeLogicalPath(path)).toBe(path);
  });

  it('turns backslashes into forward slashes', () => {
    const file = name();
    expect(normalizeLogicalPath(`specs\\${file}`)).toBe(`specs/${file}`);
  });

  it('normalizes to NFC', () => {
    expect(normalizeLogicalPath('cafe\u0301.md')).toBe('caf\u00e9.md');
  });

  it.each([
    ['an empty path', ''],
    ['traversal', '../secrets.md'],
    ['traversal in the middle', 'specs/../../secrets.md'],
    ['a dot segment', './roles.md'],
    ['an absolute POSIX path', '/etc/roles.md'],
    ['an absolute Windows path', '\\\\server\\share\\roles.md'],
    ['a drive letter', 'C:\\docs\\roles.md'],
    ['a drive-relative path', 'c:roles.md'],
    ['an empty segment', 'specs//roles.md'],
    ['a trailing slash', 'specs/'],
    ['a control character', 'specs/ro\u0007les.md'],
    ['a newline', 'specs/roles\n.md'],
    ['an overlong path', `${'a'.repeat(510)}.md`],
  ])('rejects %s', (_label, path) => {
    expect(normalizeLogicalPath(path)).toBeUndefined();
  });

  it('accepts a path of exactly the maximum length', () => {
    const path = `${'a'.repeat(509)}.md`;
    expect(normalizeLogicalPath(path)).toBe(path);
  });
});
