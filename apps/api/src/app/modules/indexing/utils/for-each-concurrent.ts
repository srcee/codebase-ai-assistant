/**
 * Runs `worker` over `items` with at most `limit` in flight. Stops pulling after the first failure,
 * waits for in-flight work to settle and rethrows that failure.
 */
export async function forEachConcurrent<T>(
  items: AsyncIterable<T>,
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const inFlight = new Set<Promise<void>>();
  let failure: { error: unknown } | undefined;
  try {
    for await (const item of items) {
      if (failure) break;
      const task: Promise<void> = worker(item)
        .catch((error: unknown) => {
          failure ??= { error };
        })
        .finally(() => inFlight.delete(task));
      inFlight.add(task);
      if (inFlight.size >= limit) await Promise.race(inFlight);
    }
  } finally {
    await Promise.all(inFlight);
  }
  if (failure) throw failure.error;
}
