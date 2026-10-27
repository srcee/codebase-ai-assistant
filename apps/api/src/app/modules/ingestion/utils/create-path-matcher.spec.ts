import { createPathMatcher } from './create-path-matcher';
import { BUILT_IN_EXCLUDE_PATTERNS } from '../constants/built-in-exclude-patterns';
import { SECRET_FILENAME_PATTERNS } from '../constants/secret-filename-patterns';

describe('createPathMatcher built-in exclusions', () => {
  const matcher = createPathMatcher(BUILT_IN_EXCLUDE_PATTERNS);

  it.each([
    ['node_modules', true],
    ['packages/a/node_modules', true],
    ['dist', true],
    ['.git', true],
    ['package-lock.json', false],
    ['apps/web/pnpm-lock.yaml', false],
    ['public/app.min.js', false],
    ['assets/logo.PNG', false],
  ])('excludes %s', (path, isDirectory) => {
    expect(matcher.matches(path, isDirectory)).toBe(true);
  });

  it.each([
    ['src/index.ts', false],
    ['src/distance.ts', false],
    ['docs/build-notes.md', false],
    ['src/app.js', false],
  ])('keeps %s', (path, isDirectory) => {
    expect(matcher.matches(path, isDirectory)).toBe(false);
  });
});

describe('createPathMatcher secret filenames', () => {
  const matcher = createPathMatcher(SECRET_FILENAME_PATTERNS);

  it.each([
    '.env',
    '.env.local',
    '.env.example',
    'apps/api/.env.production',
    'keys/server.pem',
    'tls/private.KEY',
    'id_rsa',
    'home/id_rsa.pub',
    'id_ed25519',
    'store.p12',
    'store.pfx',
    'config/credentials.json',
    'credentials',
    '.npmrc',
    'service-account-prod.json',
  ])('excludes %s', (path) => {
    expect(matcher.matches(path, false)).toBe(true);
  });

  it.each(['.ssh', '.aws', 'a/.gnupg'])('excludes directory %s', (path) => {
    expect(matcher.matches(path, true)).toBe(true);
  });

  it.each(['src/environment.ts', 'src/keyboard.ts', 'README.md'])(
    'keeps %s',
    (path) => {
      expect(matcher.matches(path, false)).toBe(false);
    },
  );

  it('applies custom patterns with negation', () => {
    const custom = createPathMatcher(['docs/', '*.snap', '!keep.snap']);
    expect(custom.matches('docs', true)).toBe(true);
    expect(custom.matches('a/b.snap', false)).toBe(true);
    expect(custom.matches('keep.snap', false)).toBe(false);
  });
});
