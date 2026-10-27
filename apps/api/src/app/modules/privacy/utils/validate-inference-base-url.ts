import { PrivacyPolicyError } from '../errors/privacy-policy.error';

// WHATWG parsing lower-cases hosts, brackets IPv6 and normalizes forms such as 127.1.
const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Returns the parsed URL, or throws without echoing the input. */
export function validateInferenceBaseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PrivacyPolicyError('INFERENCE_BASE_URL is not a valid URL');
  }
  if (url.protocol !== 'http:') {
    throw new PrivacyPolicyError('INFERENCE_BASE_URL must use http');
  }
  if (url.username || url.password) {
    throw new PrivacyPolicyError(
      'INFERENCE_BASE_URL must not contain credentials',
    );
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new PrivacyPolicyError(
      'INFERENCE_BASE_URL must not have a path, query or fragment',
    );
  }
  if (!ALLOWED_HOSTNAMES.has(url.hostname)) {
    throw new PrivacyPolicyError(
      'INFERENCE_BASE_URL host must be localhost, 127.0.0.1 or ::1',
    );
  }
  return url;
}
