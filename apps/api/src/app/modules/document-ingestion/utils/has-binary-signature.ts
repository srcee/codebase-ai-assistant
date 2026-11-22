import { BINARY_SIGNATURES } from '../constants/binary-signatures';

export function hasBinarySignature(bytes: Uint8Array): boolean {
  return BINARY_SIGNATURES.some(
    ({ bytes: signature }) =>
      signature.length <= bytes.length &&
      signature.every((byte, index) => bytes[index] === byte),
  );
}
