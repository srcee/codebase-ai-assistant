import { lstat, open } from 'node:fs/promises';

const NO_DEVICE = BigInt(0);

export type ReadOutcome =
  | { kind: 'read'; bytes: Uint8Array }
  | { kind: 'too-large' }
  | { kind: 'unreadable' };

/**
 * Reads a regular file without following a link, never more than `maxBytes`.
 * Non-regular files (FIFOs, devices) are never opened, and a file swapped for another after the check is rejected.
 */
export async function readRegularFile(
  path: string,
  maxBytes: number,
): Promise<ReadOutcome> {
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile()) return { kind: 'unreadable' };
    if (before.size > BigInt(maxBytes)) return { kind: 'too-large' };

    const handle = await open(path, 'r');
    try {
      const after = await handle.stat({ bigint: true });
      // On Windows lstat reports dev 0, so dev is only compared when both sides have one.
      const sameDevice =
        before.dev === NO_DEVICE ||
        after.dev === NO_DEVICE ||
        before.dev === after.dev;
      if (!after.isFile() || after.ino !== before.ino || !sameDevice) {
        return { kind: 'unreadable' };
      }
      const buffer = Buffer.allocUnsafe(maxBytes + 1);
      let filled = 0;
      while (filled < buffer.length) {
        const { bytesRead } = await handle.read(
          buffer,
          filled,
          buffer.length - filled,
          filled,
        );
        if (bytesRead === 0) break;
        filled += bytesRead;
      }
      if (filled > maxBytes) return { kind: 'too-large' };
      return { kind: 'read', bytes: buffer.subarray(0, filled) };
    } finally {
      await handle.close();
    }
  } catch {
    return { kind: 'unreadable' };
  }
}
