import { truncate } from './truncate';

describe('truncate', () => {
  it('keeps text within the limit', () => {
    expect(truncate('Reviewer', 8)).toBe('Reviewer');
  });

  it('ends cut text with an ellipsis inside the limit', () => {
    const cut = truncate('Reviewer permissions', 10);
    expect(cut).toBe('Reviewer …');
    expect(cut.length).toBe(10);
  });

  it('never splits a surrogate pair', () => {
    const cut = truncate('ab😀cd', 4);
    expect(cut).toBe('ab…');
    expect(() => encodeURIComponent(cut)).not.toThrow();
  });
});
