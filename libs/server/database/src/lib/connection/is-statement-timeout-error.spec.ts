import { isStatementTimeoutError } from './is-statement-timeout-error';

const timeout = () =>
  Object.assign(new Error('canceling statement due to statement timeout'), {
    code: '57014',
  });

describe('isStatementTimeoutError', () => {
  it('recognises the driver error', () => {
    expect(isStatementTimeoutError(timeout())).toBe(true);
  });

  it('recognises it behind a wrapping error', () => {
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: timeout(),
    });
    expect(isStatementTimeoutError(wrapped)).toBe(true);
  });

  it('rejects other cancellations and codes', () => {
    const userCancel = Object.assign(
      new Error('canceling statement due to user request'),
      { code: '57014' },
    );
    const other = Object.assign(new Error('statement timeout'), {
      code: '23505',
    });
    expect(isStatementTimeoutError(userCancel)).toBe(false);
    expect(isStatementTimeoutError(other)).toBe(false);
  });

  it.each([undefined, null, 'statement timeout', 42, new Error('x')])(
    'rejects %s',
    (value) => {
      expect(isStatementTimeoutError(value)).toBe(false);
    },
  );

  it('stops on a circular cause chain', () => {
    const looped: { cause?: unknown } = {};
    looped.cause = looped;
    expect(isStatementTimeoutError(looped)).toBe(false);
  });
});
