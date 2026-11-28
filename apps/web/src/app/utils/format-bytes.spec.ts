import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [3 * 1024 ** 4, '3072.0 GB'],
  ])('formats %d as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
