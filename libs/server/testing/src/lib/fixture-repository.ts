import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { linkDirectory, makeGitRepository, type Sandbox } from './sandbox';

export type FixtureFiles = Record<string, string | Uint8Array>;

export interface SampleRepository {
  path: string;
  /** Directory outside the repository that the `linked-outside` junction points to. */
  outsidePath: string;
}

export function writeFiles(root: string, files: FixtureFiles): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(root, ...relativePath.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

const repeatLines = (count: number, line: (index: number) => string): string =>
  Array.from({ length: count }, (_, index) => line(index)).join('\n');

// Fixed content on purpose: snapshots need stable output and faker is unseeded.
const textFiles = (): FixtureFiles => ({
  '.gitignore': 'generated/\n*.log\n',
  'README.md': '# Sample\n\nA synthetic repository.\n\n## Usage\n\nNone.\n',
  'package.json': '{\n  "name": "sample",\n  "version": "1.0.0"\n}\n',
  'data/records.json': '{\n  "records": [1, 2, 3]\n}\n',
  'src/math.ts': [
    "import { round } from './round';",
    '',
    '/** Adds two numbers. */',
    'export function add(a: number, b: number): number {',
    '  return a + b;',
    '}',
    '',
    '// Multiplies two numbers.',
    'export const multiply = (a: number, b: number): number => a * b;',
    '',
    'export interface Point {',
    '  x: number;',
    '  y: number;',
    '}',
    '',
    "export type Axis = 'x' | 'y';",
    '',
    'export default function main(): number {',
    '  return round(add(1, 2));',
    '}',
    '',
  ].join('\n'),
  'src/shapes.ts': [
    'export class Circle {',
    '  constructor(private readonly radius: number) {}',
    '',
    '  area(): number {',
    '    return Math.PI * this.radius ** 2;',
    '  }',
    '}',
    '',
  ].join('\n'),
  'src/big-service.ts': [
    'export class BigService {',
    repeatLines(
      12,
      (index) =>
        `  method${index}(value: number): number {\n    return value + ${index};\n  }`,
    ),
    '}',
    '',
  ].join('\n'),
  'src/huge-function.ts': [
    'export function huge(): number {',
    '  let total = 0;',
    repeatLines(40, (index) => `  total += ${index};`),
    '  return total;',
    '}',
    '',
  ].join('\n'),
  'src/view.tsx': [
    'export function View(props: { label: string }) {',
    '  return <span>{props.label}</span>;',
    '}',
    '',
  ].join('\n'),
  'src/legacy.js':
    'function legacy() {\n  return 1;\n}\nmodule.exports = legacy;\n',
  'lib/util.mjs': 'export const util = () => 2;\n',
  'lib/common.cjs': 'module.exports = { value: 3 };\n',
  'src/broken.ts': 'export function broken( {\n  const = ;\n',
  'src/crlf.ts': '\uFEFFexport const a = 1;\r\nexport const b = 2;\r\n',
  'src/empty.ts': '',
  'src/config.ts': `export const apiToken = '${CANARY_SECRET}';\n`,
  'src/too-large.ts': repeatLines(
    400,
    (index) => `export const v${index} = ${index};`,
  ),
  'src/long-line.js': `const x = '${'a'.repeat(600)}';\n`,
  'src/invalid-encoding.ts': new Uint8Array([
    ...Buffer.from("export const x = '"),
    0xc3,
    0x28,
    ...Buffer.from("';\n"),
  ]),
  'packages/a/.gitignore': 'local.ts\n',
  'packages/a/index.ts': 'export const a = 1;\n',
  'packages/a/local.ts': 'export const local = 1;\n',
  'generated/types.ts': 'export type Generated = string;\n',
  'scratch/notes.ts': 'export const notes = 1;\n',
  'notes.txt': 'plain text\n',
  'app/main.py': 'def greet(name):\n    return "hello " + name\n',
  Dockerfile: 'FROM scratch\nCOPY . /app\n',
  'scripts/clean.sh': '#!/bin/sh\nrm -rf ./tmp\n',
  'scripts/deploy.sh': `#!/bin/sh\nexport API_TOKEN=${CANARY_SECRET}\n`,
  'config/settings.yaml': `token: ${CANARY_SECRET}\n`,
});

const excludedFiles = (): FixtureFiles => ({
  '.env': `API_TOKEN=${CANARY_SECRET}\n`,
  '.env.example': 'API_TOKEN=change-me\n',
  'config/credentials.json': `{"token": "${CANARY_SECRET}"}\n`,
  'keys/server.pem': `-----BEGIN PRIVATE KEY-----\n${CANARY_SECRET}\n-----END PRIVATE KEY-----\n`,
  'keys/id_rsa': `${CANARY_SECRET}\n`,
  'package-lock.json': '{}\n',
  'dist/bundle.js': 'export const dist = 1;\n',
  'build/out.js': 'export const build = 1;\n',
  'coverage/report.json': '{}\n',
  'node_modules/dep/index.js': 'module.exports = 1;\n',
  'public/app.min.js': 'var a=1;\n',
  'assets/logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]),
  'data/blob.json': new Uint8Array([0x7b, 0x00, 0x7d]),
});

/** Builds a git repository with every kind of file discovery must include, skip or never enter. */
export function buildSampleRepository(sandbox: Sandbox): SampleRepository {
  const path = makeGitRepository(sandbox.root, 'sample');
  const outsidePath = join(sandbox.outside, 'secrets');
  writeFiles(path, { ...textFiles(), ...excludedFiles() });
  writeFiles(outsidePath, {
    'outside.ts': `export const outside = '${CANARY_SECRET}';\n`,
  });
  linkDirectory(outsidePath, join(path, 'linked-outside'));
  linkDirectory(join(path, 'src'), join(path, 'linked-inside'));
  return { path, outsidePath };
}
