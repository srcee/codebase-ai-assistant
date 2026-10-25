import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { containsSecret } from './contains-secret';

// Token shapes are assembled at runtime so this file holds no secret-looking literal.
const repeat = (char: string, count: number): string => char.repeat(count);

describe('containsSecret', () => {
  it.each([
    ['a PEM private key header', `-----BEGIN ${'RSA '}PRIVATE KEY-----`],
    ['an AWS access key id', `key = ${'AKIA'}${repeat('A', 16)}`],
    ['a GitHub token', `${'ghp'}_${repeat('a', 36)}`],
    ['a GitHub fine-grained token', `${'github_pat'}_${repeat('a', 30)}`],
    ['a Slack token', `${'xoxb'}-${repeat('1', 12)}`],
    ['a Google API key', `${'AIza'}${repeat('a', 35)}`],
    ['a live payment key', `${'sk'}_live_${repeat('a', 20)}`],
    [
      'a JWT',
      `${'eyJ'}${repeat('a', 10)}.${'eyJ'}${repeat('b', 10)}.${repeat('c', 10)}`,
    ],
    ['credentials in a URL', `db://admin:${repeat('p', 8)}@localhost/app`],
    ['a quoted password', `const password = '${repeat('x', 10)}';`],
    ['a JSON token', `{"apiToken": "${repeat('x', 12)}"}`],
    ['the shared canary', `const apiToken = '${CANARY_SECRET}';`],
    ['an exported shell variable', `export API_TOKEN=${CANARY_SECRET}`],
    ['a Dockerfile ENV', `ENV DB_PASSWORD=${repeat('x', 12)}`],
    ['a bare assignment', `  SECRET=${repeat('a', 10)}`],
  ])('detects %s', (_label, text) => {
    expect(containsSecret(text)).toBe(true);
  });

  it.each([
    'export function add(a: number, b: number) { return a + b; }',
    "const password = '';",
    "const passwordLabel = 'Enter your password';",
    "const token = 'short';",
    'const url = "http://localhost:3000/path";',
    '# Secrets\n\nDo not commit passwords.',
    'export API_TOKEN=$API_TOKEN',
    'API_TOKEN=short',
    'ARG API_TOKEN',
    'TOKEN_TTL = 86400000',
    "SECRET_KEY = os.environ['SECRET_KEY']",
    'const TOKEN_HEADER = authorization_header;',
  ])('accepts %j', (text) => {
    expect(containsSecret(text)).toBe(false);
  });

  it('returns a boolean and never the matched text', () => {
    expect(containsSecret(`const secret = '${CANARY_SECRET}';`)).toBe(true);
  });

  it('stays fast on long pathological input', () => {
    const hostile = `password${'a'.repeat(200_000)}`;
    const started = Date.now();
    expect(containsSecret(hostile)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
