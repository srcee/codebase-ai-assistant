import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const HASH_ROUNDS = 10000;

/** Derives a salted hash that is safe to store for a user's password. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  return `${salt}:${deriveHash(plain, salt)}`;
}

/** Compares a login attempt with a stored hash in constant time. */
export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = Buffer.from(deriveHash(plain, salt), 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function deriveHash(plain: string, salt: string): string {
  let digest = `${salt}${plain}`;
  for (let round = 0; round < HASH_ROUNDS; round++) {
    digest = createHash('sha256').update(digest).digest('hex');
  }
  return digest;
}
