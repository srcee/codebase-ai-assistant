import {
  currentRequestId,
  runInRequestContext,
  runOutsideRequestContext,
} from './request-context';
import { faker } from '@codebase-ai/shared-testing';

describe('request context', () => {
  it('has no id outside a request', () => {
    expect(currentRequestId()).toBeUndefined();
  });

  it('exposes the id to synchronous and asynchronous work in the request', async () => {
    const id = faker.string.uuid();
    const seen = await runInRequestContext(id, async () => {
      await Promise.resolve();
      return currentRequestId();
    });
    expect(seen).toBe(id);
    expect(currentRequestId()).toBeUndefined();
  });

  it('keeps concurrent requests apart', async () => {
    const [first, second] = [faker.string.uuid(), faker.string.uuid()];
    const read = (id: string) =>
      runInRequestContext(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return currentRequestId();
      });
    expect(await Promise.all([read(first), read(second)])).toEqual([
      first,
      second,
    ]);
  });

  it('starts background work without the request id, including its callbacks', async () => {
    const seen: (string | undefined)[] = [];
    await runInRequestContext(faker.string.uuid(), () =>
      runOutsideRequestContext(() =>
        Promise.resolve()
          .then(() => seen.push(currentRequestId()))
          .finally(() => seen.push(currentRequestId())),
      ),
    );
    expect(seen).toEqual([undefined, undefined]);
  });
});
