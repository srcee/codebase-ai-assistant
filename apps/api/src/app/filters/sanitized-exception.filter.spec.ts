import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { assertNotLeaked, CANARY_SECRET } from '@codebase-ai/shared-testing';
import { SanitizedExceptionFilter } from './sanitized-exception.filter';

function hostWithResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = { method: 'POST', route: { path: '/search' } };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('SanitizedExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps a statement timeout to a sanitized 503', () => {
    const { host, status, json } = hostWithResponse();
    const timeout = Object.assign(
      new Error(
        `canceling statement due to statement timeout ${CANARY_SECRET}`,
      ),
      { code: '57014' },
    );

    new SanitizedExceptionFilter().catch(
      Object.assign(new Error(`Failed query: select ${CANARY_SECRET}`), {
        cause: timeout,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    assertNotLeaked(json.mock.calls, CANARY_SECRET);
    assertNotLeaked(
      (Logger.prototype.warn as jest.Mock).mock.calls,
      CANARY_SECRET,
    );
  });

  it('keeps other errors as a generic 500', () => {
    const { host, status } = hostWithResponse();
    new SanitizedExceptionFilter().catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
  });
});
