import { faker } from '@codebase-ai/shared-testing';
import { sanitizeRewrite } from './sanitize-rewrite';

describe('sanitizeRewrite', () => {
  it('returns a plain query unchanged', () => {
    const query = faker.lorem.sentence();
    expect(sanitizeRewrite(query)).toBe(query);
  });

  it.each([
    ['Query: where is retryLimit tested', 'where is retryLimit tested'],
    ['"where is retryLimit tested"', 'where is retryLimit tested'],
    ['```\nwhere is retryLimit tested\n```', 'where is retryLimit tested'],
    [
      '\n\nwhere is retryLimit tested\nBecause the user asked...',
      'where is retryLimit tested',
    ],
  ])('cleans %j', (output, expected) => {
    expect(sanitizeRewrite(output)).toBe(expected);
  });

  it.each(['', '   \n ', '""', 'Query:'])(
    'returns undefined for %j',
    (output) => {
      expect(sanitizeRewrite(output)).toBeUndefined();
    },
  );

  it('caps the length', () => {
    expect(sanitizeRewrite(faker.string.alpha(5000))?.length).toBe(1000);
  });
});
