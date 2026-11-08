import { createHash } from 'node:crypto';

export interface FeatureFlag {
  name: string;
  rolloutPercent: number;
}

const FLAGS: FeatureFlag[] = [
  { name: 'new-checkout', rolloutPercent: 25 },
  { name: 'wishlist', rolloutPercent: 100 },
];

/** A user is always in or out of a gradual rollout, because the bucket comes from a hash of their id. */
export function isFeatureEnabled(flagName: string, userId: string): boolean {
  const flag = FLAGS.find((candidate) => candidate.name === flagName);
  if (!flag) return false;
  return rolloutBucket(flagName, userId) < flag.rolloutPercent;
}

export function rolloutBucket(flagName: string, userId: string): number {
  const digest = createHash('sha1').update(`${flagName}:${userId}`).digest();
  return digest.readUInt16BE(0) % 100;
}
