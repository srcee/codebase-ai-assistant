import { toTransferable } from './to-transferable';

describe('toTransferable', () => {
  it('keeps bytes that own their whole buffer', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(toTransferable(bytes)).toBe(bytes);
  });

  it('copies a view into a larger or pooled buffer', () => {
    const pooled = Buffer.from('abc');
    const view = new Uint8Array(new ArrayBuffer(8), 2, 3);
    for (const bytes of [pooled, view]) {
      const copy = toTransferable(bytes);
      expect(copy).not.toBe(bytes);
      expect(copy.byteOffset).toBe(0);
      expect(copy.buffer.byteLength).toBe(bytes.byteLength);
      expect([...copy]).toEqual([...bytes]);
    }
  });
});
