const decoder = new TextDecoder('utf-8', { fatal: true });

/** Strict UTF-8 decode that drops a BOM and normalizes CRLF and lone CR to LF; undefined if invalid. */
export function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return decoder.decode(bytes).replace(/\r\n?/g, '\n');
  } catch {
    return undefined;
  }
}
