import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  createSandbox,
  testConfig,
  type Sandbox,
} from '@codebase-ai/server-testing';
import { containsSecret } from '../../app/modules/ingestion/utils/contains-secret';
import { detectLanguage } from '../../app/modules/ingestion/utils/detect-language';
import { evalRoot } from './eval-root';
import {
  loadQuestionSet,
  QUESTION_CATEGORIES,
  QUESTIONS_FILE,
} from './eval-questions';

const root = evalRoot();
const corpusRoot = join(root, 'corpus');

const corpusFiles = (directory = corpusRoot): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? corpusFiles(path) : [path];
  });

const corpusLines = (relativePath: string): string[] =>
  readFileSync(join(corpusRoot, relativePath), 'utf8').split(/\r?\n/);

describe('evaluation question set', () => {
  const set = loadQuestionSet();

  it('is a sized, versioned set over the committed corpus', () => {
    expect(set.version).toBe(1);
    expect(set.corpus).toBe('libs/server/testing/eval/corpus');
    expect(set.questions.length).toBeGreaterThanOrEqual(20);
    expect(set.questions.length).toBeLessThanOrEqual(50);
  });

  it('has unique ids and uses every category', () => {
    const ids = set.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(set.questions.map((question) => question.category))).toEqual(
      new Set(QUESTION_CATEGORIES),
    );
  });

  it('points every expected range at existing lines that contain its anchor', () => {
    for (const question of set.questions) {
      for (const location of question.expected) {
        const lines = corpusLines(location.path);
        expect(location.startLine).toBeLessThanOrEqual(location.endLine);
        expect(location.endLine).toBeLessThanOrEqual(lines.length);
        const inRange = lines
          .slice(location.startLine - 1, location.endLine)
          .join('\n');
        expect({
          id: question.id,
          found: inRange.includes(location.anchor),
        }).toEqual({ id: question.id, found: true });
      }
    }
  });

  describe('loading', () => {
    let box: Sandbox;
    beforeEach(() => {
      box = createSandbox('caa-eval-questions-');
      mkdirSync(box.root, { recursive: true });
    });
    afterEach(() => box.dispose());

    it('rejects a question set that does not match the schema', () => {
      writeFileSync(
        join(box.root, QUESTIONS_FILE),
        JSON.stringify({
          version: 1,
          corpus: 'libs/server/testing/eval/corpus',
          questions: [
            { id: 'x', category: 'unknown', question: 'q', expected: [] },
          ],
        }),
      );
      expect(() => loadQuestionSet(box.root)).toThrow();
    });
  });
});

describe('evaluation corpus', () => {
  const config = testConfig();
  const files = corpusFiles().map((path) =>
    relative(corpusRoot, path).split(sep).join('/'),
  );

  it('is a project of a realistic size', () => {
    expect(files.length).toBeGreaterThanOrEqual(25);
    expect(files.length).toBeLessThanOrEqual(40);
  });

  it.each(files)('%s is indexable and contains no secret-like text', (path) => {
    const text = readFileSync(join(corpusRoot, path), 'utf8').replace(
      /\r\n/g,
      '\n',
    );
    expect(detectLanguage(path)).toBeDefined();
    expect(containsSecret(text)).toBe(false);
    const longest = Math.max(...text.split('\n').map((line) => line.length));
    expect(longest).toBeLessThanOrEqual(config.ingestion.chunkMaxChars);
  });
});
