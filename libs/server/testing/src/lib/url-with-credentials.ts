import { faker } from '@codebase-ai/shared-testing';

/** Adds userinfo at runtime, so no `user:password@host` literal reaches the secret scanner. */
export function urlWithCredentials(
  baseUrl: string,
  password: string = faker.internet.password(),
): string {
  const url = new URL(baseUrl);
  url.username = faker.internet.username();
  url.password = password;
  return url.href;
}
