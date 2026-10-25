import { LANGUAGES } from './languages';
import {
  CHUNKING_BY_LANGUAGE,
  KNOWN_LANGUAGE_IDS,
  LANGUAGE_BY_EXTENSION,
  LANGUAGE_BY_FILENAME,
} from './language-lookups';

describe('language registry', () => {
  const filenames = LANGUAGES.flatMap((language) =>
    'filenames' in language ? [...language.filenames] : [],
  );
  const extensions = LANGUAGES.flatMap((language) => [...language.extensions]);

  it('uses unique, well-formed ids', () => {
    const ids = LANGUAGES.map((language) => language.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9+#-]{1,32}$/);
  });

  it('assigns every extension and filename to exactly one language', () => {
    expect(new Set(extensions).size).toBe(extensions.length);
    expect(new Set(filenames).size).toBe(filenames.length);
    expect(LANGUAGE_BY_EXTENSION.size).toBe(extensions.length);
    expect(LANGUAGE_BY_FILENAME.size).toBe(filenames.length);
  });

  it('keeps extensions and filenames lower-case', () => {
    for (const extension of extensions) {
      expect(extension).toMatch(/^\.[a-z0-9]+$/);
    }
    for (const filename of filenames)
      expect(filename).toBe(filename.toLowerCase());
  });

  it('gives every language a chunking strategy', () => {
    expect(CHUNKING_BY_LANGUAGE.size).toBe(LANGUAGES.length);
    expect(KNOWN_LANGUAGE_IDS.size).toBe(LANGUAGES.length);
    expect(CHUNKING_BY_LANGUAGE.get('typescript')).toBe('typescript');
    expect(CHUNKING_BY_LANGUAGE.get('python')).toBe('lines');
  });

  it('never lists formats that commonly hold unquoted secrets', () => {
    for (const extension of [
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.env',
      '.properties',
      '.xml',
    ]) {
      expect(LANGUAGE_BY_EXTENSION.has(extension)).toBe(false);
    }
  });
});
