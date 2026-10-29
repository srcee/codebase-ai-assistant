import { forEachConcurrent } from './for-each-concurrent';

async function* fromArray<T>(items: readonly T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('forEachConcurrent', () => {
  it('processes every item without exceeding the limit', async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await forEachConcurrent(fromArray([1, 2, 3, 4, 5, 6]), 2, async (item) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      seen.push(item);
      active--;
    });
    expect(peak).toBe(2);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('stops pulling after a failure, waits for in-flight work and rethrows', async () => {
    const failure = new Error('boom');
    const started: number[] = [];
    let finished = 0;
    const run = forEachConcurrent(
      fromArray([1, 2, 3, 4, 5]),
      2,
      async (item) => {
        started.push(item);
        await tick();
        if (item === 1) throw failure;
        finished++;
      },
    );
    await expect(run).rejects.toBe(failure);
    expect(started).toEqual([1, 2]);
    expect(finished).toBe(1);
  });

  it('waits for in-flight work when the source throws', async () => {
    const failure = new Error('source');
    let finished = 0;
    async function* failing(): AsyncGenerator<number> {
      yield 1;
      throw failure;
    }
    await expect(
      forEachConcurrent(failing(), 2, async () => {
        await tick();
        finished++;
      }),
    ).rejects.toBe(failure);
    expect(finished).toBe(1);
  });
});
