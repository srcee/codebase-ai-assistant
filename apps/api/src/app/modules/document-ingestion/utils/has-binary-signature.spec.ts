import { BINARY_SIGNATURES } from '../constants/binary-signatures';
import { hasBinarySignature } from './has-binary-signature';

describe('hasBinarySignature', () => {
  it.each(BINARY_SIGNATURES)('recognises $format', ({ bytes }) => {
    expect(hasBinarySignature(Uint8Array.from([...bytes, 0x41, 0x42]))).toBe(
      true,
    );
  });

  it('ignores text, short input, and a signature that is not at the start', () => {
    const text = new TextEncoder().encode('# Roles\n%PDF-1.7 is a version');
    expect(hasBinarySignature(text)).toBe(false);
    expect(hasBinarySignature(Uint8Array.from([0x25, 0x50]))).toBe(false);
    expect(hasBinarySignature(new Uint8Array())).toBe(false);
  });
});
