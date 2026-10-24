import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import type { PathRejectionReason } from '../types/path-rejection-reason';
import { PathRejectedError } from './path-rejected.error';

const REASONS: PathRejectionReason[] = [
  'invalid-path',
  'not-found',
  'outside-allowed-roots',
  'not-a-directory',
  'not-a-git-repository',
];

describe('PathRejectedError', () => {
  it.each(REASONS)('exposes the reason and a message for %s', (reason) => {
    const error = new PathRejectedError(reason);
    expect(error.reason).toBe(reason);
    expect(error.name).toBe('PathRejectedError');
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('gives a missing path and an outside path the same message', () => {
    expect(new PathRejectedError('not-found').message).toBe(
      new PathRejectedError('outside-allowed-roots').message,
    );
  });

  it('never builds the message from a path', () => {
    const path = faker.system.directoryPath();
    for (const reason of REASONS) {
      assertNotLeaked(new PathRejectedError(reason).message, path);
    }
  });
});
