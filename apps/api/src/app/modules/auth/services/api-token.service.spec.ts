import {
  chmodSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  createSandbox,
  type Sandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import { ApiTokenFileError } from '../errors/api-token-file.error';
import { ApiTokenService } from './api-token.service';

const posixIt = process.platform === 'win32' ? it.skip : it;

describe('ApiTokenService', () => {
  let box: Sandbox;

  const serviceFor = (tokenFile: string) =>
    new ApiTokenService(testConfig({ API_TOKEN_FILE: tokenFile }));
  const started = (tokenFile: string): ApiTokenService => {
    const service = serviceFor(tokenFile);
    service.onModuleInit();
    return service;
  };
  const tokenPath = () =>
    join(box.root, `${faker.string.alphanumeric(8)}`, 'token.secret');

  beforeEach(() => {
    box = createSandbox('caa-token-');
  });

  afterEach(() => {
    box.dispose();
  });

  it('creates the token file, with missing folders, on first start', () => {
    const path = tokenPath();
    started(path);
    expect(readFileSync(path, 'utf8')).toMatch(/^[A-Za-z0-9_-]{43}\n$/);
  });

  it('accepts the stored token and nothing else', () => {
    const path = tokenPath();
    const service = started(path);
    const token = readFileSync(path, 'utf8').trim();

    expect(service.matches(token)).toBe(true);
    expect(service.matches(faker.string.alphanumeric(43))).toBe(false);
    expect(service.matches(`${token}x`)).toBe(false);
    expect(service.matches('')).toBe(false);
  });

  it('keeps the same token across restarts', () => {
    const path = tokenPath();
    started(path);
    const token = readFileSync(path, 'utf8').trim();

    expect(started(path).matches(token)).toBe(true);
    expect(readFileSync(path, 'utf8').trim()).toBe(token);
  });

  it('generates a different token per install', () => {
    const [first, second] = [tokenPath(), tokenPath()];
    started(first);
    started(second);
    expect(readFileSync(first, 'utf8')).not.toBe(readFileSync(second, 'utf8'));
  });

  it('accepts a token file edited by hand, with or without a newline', () => {
    const path = tokenPath();
    const token = faker.string.alphanumeric({ length: 43 });
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `  ${token}`, { mode: 0o600 });
    expect(started(path).matches(token)).toBe(true);
  });

  it('rejects nothing before it has started', () => {
    expect(serviceFor(tokenPath()).matches(faker.string.alphanumeric(43))).toBe(
      false,
    );
  });

  it('refuses a malformed token file without echoing it', () => {
    const path = tokenPath();
    const content = `short-${faker.string.alphanumeric(8)}`;
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content, { mode: 0o600 });

    const failure = (() => {
      try {
        started(path);
      } catch (error) {
        return error;
      }
    })();
    expect(failure).toBeInstanceOf(ApiTokenFileError);
    assertNotLeaked((failure as Error).message, content, path);
  });

  it('refuses a token file it cannot create', () => {
    const blocker = join(box.root, 'blocker');
    mkdirSync(box.root, { recursive: true });
    writeFileSync(blocker, '');
    expect(() => started(join(blocker, 'token.secret'))).toThrow(
      ApiTokenFileError,
    );
  });

  posixIt('creates the file readable by its owner only', () => {
    const path = tokenPath();
    started(path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(path, '..')).mode & 0o077).toBe(0);
  });

  posixIt('refuses a token file other users can read', () => {
    const path = tokenPath();
    started(path);
    chmodSync(path, 0o644);
    expect(() => started(path)).toThrow(/permissions/);
  });
});
