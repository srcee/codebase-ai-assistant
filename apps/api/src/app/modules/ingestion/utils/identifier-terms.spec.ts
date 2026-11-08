import { searchTermsFor, splitIdentifier } from './identifier-terms';

describe('splitIdentifier', () => {
  it.each([
    ['getUserById', ['get', 'user', 'by', 'id']],
    ['UserRepository', ['user', 'repository']],
    ['parse_http_response', ['parse', 'http', 'response']],
    ['MAX_RETRY_COUNT', ['max', 'retry', 'count']],
    ['HTTPServer', ['http', 'server']],
    ['loadXMLFile', ['load', 'xml', 'file']],
    ['$scopeName', ['scope', 'name']],
    ['sha256Hash', ['sha256', 'hash']],
  ])('splits %s', (identifier, parts) => {
    expect(splitIdentifier(identifier)).toEqual(parts);
  });

  it.each(['user', 'USER', 'x', 'getX', '_', 'a1'])(
    'returns nothing for %s',
    (identifier) => {
      expect(splitIdentifier(identifier)).toEqual([]);
    },
  );
});

describe('searchTermsFor', () => {
  it('collects the parts of every compound identifier once', () => {
    const terms = searchTermsFor(
      'export function getUserById(userId) { return user_cache.get(userId); }',
    );
    expect(terms.split(' ').sort()).toEqual(
      ['by', 'cache', 'get', 'id', 'user'].sort(),
    );
  });

  it('is empty for text without compound identifiers', () => {
    expect(searchTermsFor('const a = 1; // plain words only')).toBe('');
  });

  it('ignores punctuation and numbers that are not identifiers', () => {
    expect(searchTermsFor('12345 .. ::: 3.14')).toBe('');
  });

  it('is bounded for very large inputs', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `aa${i}Bb`).join(' ');
    expect(searchTermsFor(text).split(' ').length).toBeLessThanOrEqual(1000);
  });
});
