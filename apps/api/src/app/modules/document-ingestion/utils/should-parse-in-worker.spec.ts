import { shouldParseInWorker } from './should-parse-in-worker';

describe('shouldParseInWorker', () => {
  it('always sends binary formats to a worker', () => {
    expect(shouldParseInWorker({ encoding: 'binary' }, 10, 1024)).toBe(true);
  });

  it('parses text inline up to the threshold and in a worker above it', () => {
    expect(shouldParseInWorker({ encoding: 'text' }, 1024, 1024)).toBe(false);
    expect(shouldParseInWorker({ encoding: 'text' }, 1025, 1024)).toBe(true);
    expect(shouldParseInWorker({ encoding: 'text' }, 1, 0)).toBe(true);
  });
});
