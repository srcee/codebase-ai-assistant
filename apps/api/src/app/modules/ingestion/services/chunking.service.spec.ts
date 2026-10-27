import { testConfig } from '@codebase-ai/server-testing';
import { assertChunksCoverSource } from '../../../../testing/assert-chunks-cover-source';
import { includedFileFactory } from '../../../../testing/factories/included-file.factory';
import * as parser from '../utils/parse-typescript';
import { sha256Hex } from '../utils/sha256-hex';
import { ChunkingService } from './chunking.service';

const service = new ChunkingService(
  testConfig({ CHUNK_MAX_CHARS: '200', CHUNK_OVERLAP_CHARS: '40' }),
);

const typescriptFile = (lines: string[], relativePath = 'src/a.ts') =>
  includedFileFactory.build({ relativePath, text: lines.join('\n') + '\n' });

const summary = (chunks: ReturnType<ChunkingService['chunk']>) =>
  chunks.map((chunk) => [chunk.symbolName, chunk.startLine, chunk.endLine]);

describe('ChunkingService', () => {
  describe('TypeScript symbols', () => {
    const file = typescriptFile([
      "import { round } from './round';",
      '',
      '/** Adds two numbers. */',
      'export function add(a: number, b: number): number {',
      '  return a + b;',
      '}',
      '',
      '// Multiplies.',
      'export const multiply = (a: number) => a * 2;',
      '',
      'export interface Point {',
      '  x: number;',
      '}',
    ]);

    it('creates one chunk per symbol with adjacent comments and an unnamed chunk for loose code', () => {
      const chunks = service.chunk(file);
      expect(summary(chunks)).toEqual([
        [undefined, 1, 1],
        ['add', 3, 6],
        ['multiply', 8, 9],
        ['Point', 11, 13],
      ]);
      assertChunksCoverSource(file.text, chunks);
    });

    it('copies metadata and hashes the content', () => {
      const [first, second] = service.chunk(file);
      expect(first).not.toHaveProperty('symbolName');
      expect(second).toEqual({
        relativePath: file.relativePath,
        language: 'typescript',
        symbolName: 'add',
        startLine: 3,
        endLine: 6,
        content:
          '/** Adds two numbers. */\nexport function add(a: number, b: number): number {\n  return a + b;\n}',
        chunkHash: sha256Hex(second.content),
      });
    });

    it('does not attach a comment separated by a blank line', () => {
      const chunks = service.chunk(
        typescriptFile(['// detached', '', 'export const a = 1;']),
      );
      expect(summary(chunks)).toEqual([
        [undefined, 1, 1],
        ['a', 3, 3],
      ]);
    });

    it('names variable statements, default exports and declarations', () => {
      const chunks = service.chunk(
        typescriptFile([
          'export const a = 1, b = 2;',
          'export default function () {}',
          'export enum Color { Red }',
          "export type Axis = 'x';",
          'declare module "m" {}',
          'export default a;',
        ]),
      );
      expect(chunks.map((chunk) => chunk.symbolName)).toEqual([
        'a, b',
        'default',
        'Color',
        'Axis',
        'm',
        'default',
      ]);
    });

    it('treats destructuring and expression statements as unnamed code', () => {
      const chunks = service.chunk(
        typescriptFile(['const { a } = source;', 'run(a);']),
      );
      expect(summary(chunks)).toEqual([[undefined, 1, 2]]);
    });

    it('merges symbols that share a line', () => {
      const chunks = service.chunk(
        typescriptFile(['const a = 1; const b = 2;', 'const c = 3;']),
      );
      expect(summary(chunks)).toEqual([
        ['a', 1, 1],
        ['c', 2, 2],
      ]);
    });

    it('supports TSX and JavaScript files', () => {
      const tsx = service.chunk(
        typescriptFile(['export const V = () => <b>x</b>;'], 'src/view.tsx'),
      );
      expect(tsx.map((chunk) => chunk.symbolName)).toEqual(['V']);
      const js = service.chunk(
        includedFileFactory.build({
          relativePath: 'lib/a.mjs',
          language: 'javascript',
          text: 'export function f() {}\n',
        }),
      );
      expect(js).toMatchObject([{ symbolName: 'f', language: 'javascript' }]);
    });
  });

  describe('oversized symbols', () => {
    const members = Array.from({ length: 6 }, (_, index) => [
      `  method${index}(value: number): number {`,
      `    return value + ${index};`,
      '  }',
    ]).flat();

    it('splits a large class by member with a header and the closing brace on the last member', () => {
      const file = typescriptFile([
        'export class Big {',
        '  constructor(private readonly n: number) {}',
        '',
        ...members,
        '}',
      ]);
      const chunks = service.chunk(file);
      expect(chunks.map((chunk) => chunk.symbolName)).toEqual([
        'Big',
        'Big.constructor',
        'Big.method0',
        'Big.method1',
        'Big.method2',
        'Big.method3',
        'Big.method4',
        'Big.method5',
      ]);
      expect(chunks[chunks.length - 1].content.endsWith('}\n}')).toBe(true);
      assertChunksCoverSource(file.text, chunks);
    });

    it('names accessors, static blocks, string and computed members', () => {
      const body = Array.from({ length: 8 }, (_, i) => `  field${i} = ${i};`);
      const file = typescriptFile([
        'class C {',
        ...body,
        '  static { init(); }',
        "  'quoted-name'() {}",
        '  [Symbol.iterator]() {}',
        '  get value() { return 1; }',
        '  ;',
        '  [key: string]: unknown;',
        '}',
      ]);
      const names = service.chunk(file).map((chunk) => chunk.symbolName);
      expect(names).toEqual(
        expect.arrayContaining([
          'C.static',
          'C.quoted-name',
          'C.[computed]',
          'C.value',
          'C.[index]',
        ]),
      );
    });

    it('splits an oversized member into overlapping windows that keep its name', () => {
      const body = Array.from({ length: 30 }, (_, i) => `    total += ${i};`);
      const file = typescriptFile([
        'export class Big {',
        '  big(): number {',
        '    let total = 0;',
        ...body,
        '    return total;',
        '  }',
        '}',
      ]);
      const chunks = service.chunk(file);
      const windows = chunks.filter((chunk) => chunk.symbolName === 'Big.big');
      expect(windows.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(200);
      }
      windows.slice(1).forEach((window, index) => {
        expect(window.startLine).toBeLessThanOrEqual(windows[index].endLine);
        expect(window.startLine).toBeGreaterThan(windows[index].startLine);
      });
      assertChunksCoverSource(file.text, chunks);
    });

    it('windows a large function and keeps its name', () => {
      const body = Array.from({ length: 40 }, (_, i) => `  total += ${i};`);
      const file = typescriptFile([
        'export function huge(): number {',
        '  let total = 0;',
        ...body,
        '  return total;',
        '}',
      ]);
      const chunks = service.chunk(file);
      expect(chunks.length).toBeGreaterThan(1);
      expect(new Set(chunks.map((chunk) => chunk.symbolName))).toEqual(
        new Set(['huge']),
      );
      assertChunksCoverSource(file.text, chunks);
    });

    it('windows a large class without members and large loose code', () => {
      const filler = Array.from({ length: 30 }, (_, i) => `// comment ${i}`);
      const file = typescriptFile([...filler, 'class Empty {}', ...filler]);
      const chunks = service.chunk(file);
      expect(chunks.some((chunk) => chunk.symbolName === 'Empty')).toBe(true);
      expect(chunks.length).toBeGreaterThan(3);
      assertChunksCoverSource(file.text, chunks);
    });

    it('keeps members that share a line in one chunk named after the first', () => {
      const file = typescriptFile([
        `class Wide { ${Array.from({ length: 30 }, (_, i) => `m${i}() {}`).join(' ')} }`,
      ]);
      expect(service.chunk(file).map((chunk) => chunk.symbolName)).toEqual([
        'Wide.m0',
      ]);
    });
  });

  describe('fallbacks', () => {
    it('uses line chunks for malformed TypeScript', () => {
      const file = typescriptFile(['export function broken( {', '  const = ;']);
      const chunks = service.chunk(file);
      expect(summary(chunks)).toEqual([[undefined, 1, 2]]);
      assertChunksCoverSource(file.text, chunks);
    });

    it('uses line chunks when the parser throws', () => {
      jest.spyOn(parser, 'parseTypeScript').mockImplementation(() => {
        throw new RangeError('Maximum call stack size exceeded');
      });
      const chunks = service.chunk(typescriptFile(['export const a = 1;']));
      expect(summary(chunks)).toEqual([[undefined, 1, 1]]);
    });

    it('uses line chunks for JSON and Markdown', () => {
      const lines = Array.from({ length: 40 }, (_, i) => `line ${i}`);
      const text = lines.join('\n') + '\n';
      for (const language of ['json', 'markdown'] as const) {
        const file = includedFileFactory.build({ language, text });
        const chunks = service.chunk(file);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every((chunk) => !('symbolName' in chunk))).toBe(true);
        assertChunksCoverSource(text, chunks);
      }
    });

    it('returns no chunks for empty or blank files', () => {
      expect(service.chunk(typescriptFile([]))).toEqual([]);
      expect(
        service.chunk(
          includedFileFactory.build({ language: 'markdown', text: '\n\n  \n' }),
        ),
      ).toEqual([]);
    });
  });

  it('is deterministic', () => {
    const file = typescriptFile([
      'export class A {',
      ...Array.from({ length: 20 }, (_, i) => `  m${i}() { return ${i}; }`),
      '}',
    ]);
    expect(service.chunk(file)).toEqual(service.chunk({ ...file }));
  });
});
