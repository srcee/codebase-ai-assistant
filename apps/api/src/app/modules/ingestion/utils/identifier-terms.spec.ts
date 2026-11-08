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
  const words = (text: string) => searchTermsFor(text).split(' ').sort();

  it('collects each word once, lower-cased, with the parts of camelCase words', () => {
    expect(
      words(
        'export function getUserById(userId) { return user_cache.get(userId); }',
      ),
    ).toEqual(
      [
        'by',
        'cache',
        'export',
        'function',
        'get',
        'getuserbyid',
        'id',
        'return',
        'user',
        'userid',
      ].sort(),
    );
  });

  it('splits dotted and path-like text that Postgres keeps as one lexeme', () => {
    expect(words('this.userService.findOne(id)')).toEqual(
      [
        'find',
        'findone',
        'id',
        'one',
        'service',
        'this',
        'user',
        'userservice',
      ].sort(),
    );
  });

  it('drops single characters', () => {
    expect(searchTermsFor('const a = 1; b')).toBe('const');
  });

  it('is empty without words', () => {
    expect(searchTermsFor('.. ::: {}')).toBe('');
  });

  it('is bounded for very large inputs', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `aa${i}Bb`).join(' ');
    expect(searchTermsFor(text).split(' ').length).toBeLessThanOrEqual(2000);
  });
});
