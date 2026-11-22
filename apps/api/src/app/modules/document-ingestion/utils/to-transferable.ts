/** Bytes backed by an ArrayBuffer of their own, so transferring it detaches no other view, such as a pooled Buffer. */
export function toTransferable(bytes: Uint8Array): Uint8Array {
  const owned =
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength;
  return owned ? bytes : new Uint8Array(bytes);
}
