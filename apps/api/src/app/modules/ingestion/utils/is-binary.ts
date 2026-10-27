const BINARY_SNIFF_BYTES = 8192;

/** A NUL byte in the first 8 KiB marks the file as binary. */
export function isBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, BINARY_SNIFF_BYTES);
  for (let index = 0; index < end; index++) {
    if (bytes[index] === 0) return true;
  }
  return false;
}
