import { isBinary } from './is-binary';

describe('isBinary', () => {
  it('flags a NUL byte within the first 8 KiB', () => {
    expect(isBinary(new Uint8Array([0x61, 0x00, 0x62]))).toBe(true);
  });

  it('ignores a NUL byte after the sniffed prefix', () => {
    const bytes = new Uint8Array(9000).fill(0x61);
    bytes[8500] = 0;
    expect(isBinary(bytes)).toBe(false);
  });

  it('treats text and empty input as non-binary', () => {
    expect(isBinary(Buffer.from('hello'))).toBe(false);
    expect(isBinary(new Uint8Array())).toBe(false);
  });
});
