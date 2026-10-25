import { mergeSegments } from './merge-segments';

describe('mergeSegments', () => {
  it('sorts segments', () => {
    expect(
      mergeSegments([
        { startLine: 5, endLine: 6 },
        { startLine: 1, endLine: 2 },
      ]),
    ).toEqual([
      { startLine: 1, endLine: 2 },
      { startLine: 5, endLine: 6 },
    ]);
  });

  it('joins segments that share a line, keeping the first name and dropping split', () => {
    const split = () => [];
    expect(
      mergeSegments([
        { startLine: 1, endLine: 3, symbolName: 'a', split },
        { startLine: 3, endLine: 5, symbolName: 'b' },
        { startLine: 6, endLine: 6, symbolName: 'c', split },
      ]),
    ).toEqual([
      { startLine: 1, endLine: 5, symbolName: 'a' },
      { startLine: 6, endLine: 6, symbolName: 'c', split },
    ]);
  });

  it('keeps the larger end when one segment contains another', () => {
    expect(
      mergeSegments([
        { startLine: 1, endLine: 9 },
        { startLine: 2, endLine: 3 },
      ]),
    ).toEqual([{ startLine: 1, endLine: 9, symbolName: undefined }]);
  });
});
