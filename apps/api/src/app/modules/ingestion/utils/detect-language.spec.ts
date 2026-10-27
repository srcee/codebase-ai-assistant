import { detectLanguage, fileExtension } from './detect-language';

describe('detectLanguage', () => {
  it.each([
    ['src/a.ts', 'typescript'],
    ['src/view.TSX', 'typescript'],
    ['types/a.d.ts', 'typescript'],
    ['a.js', 'javascript'],
    ['a.jsx', 'javascript'],
    ['a.mjs', 'javascript'],
    ['a.cjs', 'javascript'],
    ['package.json', 'json'],
    ['docs/README.md', 'markdown'],
    ['app/main.py', 'python'],
    ['cmd/server.go', 'go'],
    ['src/Main.java', 'java'],
    ['src/lib.rs', 'rust'],
    ['src/Program.cs', 'csharp'],
    ['include/a.hpp', 'cpp'],
    ['scripts/run.SH', 'shell'],
    ['styles/app.scss', 'css'],
    ['Dockerfile', 'dockerfile'],
    ['docker/DOCKERFILE', 'dockerfile'],
    ['api.dockerfile', 'dockerfile'],
    ['Makefile', 'makefile'],
    ['build/GNUmakefile', 'makefile'],
  ])('maps %s to %s', (path, language) => {
    expect(detectLanguage(path)).toBe(language);
  });

  it.each([
    'notes.txt',
    'Makefile.bak',
    '.gitignore',
    'a.unknown',
    'config.yaml',
    'settings.toml',
    'app.env',
  ])('returns undefined for %s', (path) => {
    expect(detectLanguage(path)).toBeUndefined();
  });

  it('lower-cases the extension', () => {
    expect(fileExtension('a/B.MD')).toBe('.md');
  });
});
