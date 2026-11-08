import { buildLexicalQuery } from './build-lexical-query';

describe('buildLexicalQuery', () => {
  const terms = (text: string) => buildLexicalQuery(text)?.tsquery.split(' | ');

  it('searches whole identifiers and their parts', () => {
    expect(terms('getUserById')).toEqual(['getuserbyid', 'get', 'user', 'id']);
  });

  it('drops stopwords and single characters', () => {
    expect(terms('where is the retry handler')).toEqual(['retry', 'handler']);
  });

  it('treats snake_case and dotted names as separate words', () => {
    expect(terms('parse_http this.config.get')).toEqual([
      'parse',
      'http',
      'this',
      'config',
      'get',
    ]);
  });

  it('keeps the original text for phrase matching', () => {
    expect(buildLexicalQuery('connection refused by host')?.phrase).toBe(
      'connection refused by host',
    );
  });

  it('returns undefined when nothing searchable remains', () => {
    expect(buildLexicalQuery('is the')).toBeUndefined();
    expect(buildLexicalQuery("':*&|!<->()")).toBeUndefined();
    expect(buildLexicalQuery('')).toBeUndefined();
  });

  it.each(["'; drop table code_chunks; --", 'a & b | !c <-> d:*', '(((', '\\'])(
    'emits only alphanumeric terms for %s',
    (hostile) => {
      const query = buildLexicalQuery(hostile);
      if (query) expect(query.tsquery).toMatch(/^[a-z0-9]+( \| [a-z0-9]+)*$/);
    },
  );

  it('limits the number of terms', () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    expect(terms(text)).toHaveLength(64);
  });
});
