import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runInRequestContext<T>(requestId: string, work: () => T): T {
  return storage.run({ requestId }, work);
}

/** Undefined outside a request, for example in startup code and background jobs. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Runs background work without inheriting the id of the request that started it. */
export function runOutsideRequestContext<T>(work: () => T): T {
  return storage.exit(work);
}
