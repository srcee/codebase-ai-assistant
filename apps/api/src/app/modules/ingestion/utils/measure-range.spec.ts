import { createRangeMeasure } from './measure-range';

describe('createRangeMeasure', () => {
  const lines = ['ab', 'cde', '', 'f'];
  const measure = createRangeMeasure(lines);

  it.each([
    [1, 1],
    [1, 2],
    [2, 4],
    [1, 4],
    [3, 3],
  ])('measures lines %i..%i like the joined text', (start, end) => {
    expect(measure(start, end)).toBe(
      lines.slice(start - 1, end).join('\n').length,
    );
  });

  it('measures an empty range as -1', () => {
    expect(measure(3, 2)).toBe(-1);
  });
});
