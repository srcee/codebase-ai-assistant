import { join, resolve, sep } from 'node:path';
import { faker } from '@codebase-ai/shared-testing';
import { relativeToAnyRoot, relativeWithin } from './relative-within';

const segment = (label: string) => `${faker.word.noun()}-${label}`;
const absolute = (...parts: string[]) => resolve(sep, ...parts);

describe('relativeWithin', () => {
  const root = absolute(segment('root'));

  it('returns "." for the root itself', () => {
    expect(relativeWithin(root, root)).toBe('.');
  });

  it('returns a forward-slash path below the root', () => {
    const first = segment('a');
    const second = segment('b');
    expect(relativeWithin(root, join(root, first, second))).toBe(
      `${first}/${second}`,
    );
  });

  it('returns null for the parent of the root', () => {
    expect(relativeWithin(root, join(root, '..'))).toBeNull();
  });

  it('returns null for a sibling that shares the root name as a prefix', () => {
    expect(relativeWithin(root, `${root}-evil`)).toBeNull();
  });

  it('returns null for an unrelated path', () => {
    expect(relativeWithin(root, absolute(segment('other')))).toBeNull();
  });
});

describe('relativeToAnyRoot', () => {
  const roots = [absolute(segment('first')), absolute(segment('second'))];

  it('uses the first root that contains the target', () => {
    const child = segment('child');
    expect(relativeToAnyRoot(roots, join(roots[1], child))).toBe(child);
  });

  it('returns null when no root contains the target', () => {
    expect(relativeToAnyRoot(roots, absolute(segment('other')))).toBeNull();
  });

  it('returns null without roots', () => {
    expect(relativeToAnyRoot([], roots[0])).toBeNull();
  });
});
