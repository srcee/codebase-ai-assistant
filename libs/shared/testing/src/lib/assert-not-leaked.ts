/** Throws if any canary appears in the value; the message never repeats the value. */
export function assertNotLeaked(
  value: unknown,
  ...canaries: readonly string[]
): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  canaries.forEach((canary, index) => {
    if (text.includes(canary)) {
      throw new Error(`Output contains canary #${index + 1}`);
    }
  });
}
