import { decodeUtf8 } from './decode-utf8';

describe('decodeUtf8', () => {
  it('drops the BOM and normalizes line endings', () => {
    expect(decodeUtf8(Buffer.from('\uFEFFa\r\nb\rc\n'))).toBe('a\nb\nc\n');
  });

  it('keeps multi-byte characters', () => {
    expect(decodeUtf8(Buffer.from('héllo ✓'))).toBe('héllo ✓');
  });

  it('returns undefined for invalid UTF-8', () => {
    expect(decodeUtf8(new Uint8Array([0xc3, 0x28]))).toBeUndefined();
  });
});
