import { lookup } from 'node:dns/promises';
import { PrivacyPolicyError } from '../errors/privacy-policy.error';
import type { InferenceEndpoint } from '../types/inference-endpoint';
import { validateInferenceBaseUrl } from './validate-inference-base-url';

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type LookupAll = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultLookup: LookupAll = (hostname) => lookup(hostname, { all: true });

function isLoopbackAddress({ address, family }: ResolvedAddress): boolean {
  return family === 6 ? address === '::1' : address.startsWith('127.');
}

/** Pins `localhost` to the loopback IP it resolves to now, so later DNS changes cannot redirect traffic. */
export async function resolveLocalEndpoint(
  baseUrl: string,
  lookupAll: LookupAll = defaultLookup,
): Promise<InferenceEndpoint> {
  const url = validateInferenceBaseUrl(baseUrl);
  if (url.hostname !== 'localhost') {
    return { origin: url.origin };
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await lookupAll('localhost');
  } catch {
    throw new PrivacyPolicyError('localhost could not be resolved');
  }
  if (addresses.length === 0 || !addresses.every(isLoopbackAddress)) {
    throw new PrivacyPolicyError('localhost does not resolve to loopback only');
  }
  const preferred = addresses.find((a) => a.family === 4) ?? addresses[0];
  const host =
    preferred.family === 6 ? `[${preferred.address}]` : preferred.address;
  return { origin: `http://${host}${url.port ? `:${url.port}` : ''}` };
}
