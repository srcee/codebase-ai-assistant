import type { Locator } from '@codebase-ai/contracts';
import { locatorsOverlap } from './locators-overlap';

describe('locatorsOverlap', () => {
  it.each<[string, Locator, Locator]>([
    [
      'overlapping lines',
      { kind: 'lines', startLine: 1, endLine: 10 },
      { kind: 'lines', startLine: 10, endLine: 20 },
    ],
    [
      'the same section',
      { kind: 'section', headingPath: ['Roles', 'Reviewer'], page: 2 },
      { kind: 'section', headingPath: ['Roles', 'Reviewer'], page: 2 },
    ],
    ['the same page', { kind: 'page', page: 3 }, { kind: 'page', page: 3 }],
    [
      'overlapping rows of the same table',
      { kind: 'table_rows', sheet: 'S', rowStart: 1, rowEnd: 5, columns: [] },
      { kind: 'table_rows', sheet: 'S', rowStart: 5, rowEnd: 9, columns: [] },
    ],
    [
      'the same schema entity',
      { kind: 'schema_entity', entity: 'Role', path: 'paths./roles.get' },
      { kind: 'schema_entity', entity: 'Role', path: 'paths./roles.get' },
    ],
    [
      'the same image frame',
      { kind: 'image', frame: 'Login' },
      { kind: 'image', frame: 'Login' },
    ],
  ])('matches %s', (_label, a, b) => {
    expect(locatorsOverlap(a, b)).toBe(true);
    expect(locatorsOverlap(b, a)).toBe(true);
  });

  it.each<[string, Locator, Locator]>([
    [
      'adjacent lines',
      { kind: 'lines', startLine: 1, endLine: 10 },
      { kind: 'lines', startLine: 11, endLine: 20 },
    ],
    [
      'sibling sections',
      { kind: 'section', headingPath: ['Roles', 'Reviewer'] },
      { kind: 'section', headingPath: ['Roles', 'Admin'] },
    ],
    [
      'a parent and child section',
      { kind: 'section', headingPath: ['Roles'] },
      { kind: 'section', headingPath: ['Roles', 'Admin'] },
    ],
    ['different pages', { kind: 'page', page: 1 }, { kind: 'page', page: 2 }],
    [
      'rows of different sheets',
      { kind: 'table_rows', sheet: 'A', rowStart: 1, rowEnd: 5, columns: [] },
      { kind: 'table_rows', sheet: 'B', rowStart: 1, rowEnd: 5, columns: [] },
    ],
    [
      'different schema paths',
      { kind: 'schema_entity', entity: 'Role', path: 'paths./roles.get' },
      { kind: 'schema_entity', entity: 'Role', path: 'paths./roles.post' },
    ],
    [
      'different kinds',
      { kind: 'page', page: 1 },
      { kind: 'section', headingPath: ['Intro'], page: 1 },
    ],
  ])('does not match %s', (_label, a, b) => {
    expect(locatorsOverlap(a, b)).toBe(false);
    expect(locatorsOverlap(b, a)).toBe(false);
  });
});
