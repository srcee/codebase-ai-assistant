import { headingName, titleOf } from './heading-path';

describe('heading paths', () => {
  it('names an empty heading so locators keep a segment', () => {
    expect(headingName('')).toBe('(untitled)');
    expect(headingName('Reviewer')).toBe('Reviewer');
  });

  it('bounds a single heading', () => {
    expect(headingName('x'.repeat(500)).length).toBe(200);
  });

  it('joins the path and keeps the title within a quarter of a chunk', () => {
    expect(titleOf(['Roles', 'Reviewer', 'Permissions'], 2000)).toBe(
      'Roles > Reviewer > Permissions',
    );
    expect(titleOf(['Roles', 'Reviewer', 'Permissions'], 40)).toHaveLength(10);
  });
});
