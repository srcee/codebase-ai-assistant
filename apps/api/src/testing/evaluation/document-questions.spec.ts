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
import type { DocumentFormat } from '../../app/modules/document-ingestion/types/document-format';
import { documentFormatFor } from '../../app/modules/document-ingestion/utils/document-format-for';
import { parseDocument } from '../../app/modules/document-ingestion/utils/parse-document';
import { containsSecret } from '../../app/modules/ingestion/utils/contains-secret';
import {
  DOCUMENT_EVAL_FOLDER,
  DOCUMENT_QUESTION_CATEGORIES,
  DOCUMENT_QUESTIONS_FILE,
  loadDocumentQuestionSet,
} from './document-questions';
import { evalRoot } from './eval-root';
import { hitsTarget } from './metrics';

const corpusRoot = join(evalRoot(), DOCUMENT_EVAL_FOLDER, 'corpus');

const corpusFiles = (directory = corpusRoot): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? corpusFiles(path) : [path];
  });

const files = corpusFiles().map((path) =>
  relative(corpusRoot, path).split(sep).join('/'),
);

const { ingestion } = testConfig();
const chunksOf = (path: string) => {
  const result = parseDocument({
    format: (documentFormatFor(path) as DocumentFormat).id,
    bytes: readFileSync(join(corpusRoot, ...path.split('/'))),
    limits: {
      chunkMaxChars: ingestion.chunkMaxChars,
      chunkOverlapChars: ingestion.chunkOverlapChars,
    },
  });
  return result.kind === 'chunks' ? result.chunks : [];
};

describe('document evaluation question set', () => {
  const set = loadDocumentQuestionSet();

  it('is a sized, versioned set over the committed corpus', () => {
    expect(set.version).toBe(1);
    expect(set.corpus).toBe('libs/server/testing/eval/documents/corpus');
    expect(set.questions.length).toBeGreaterThanOrEqual(20);
    expect(set.questions.length).toBeLessThanOrEqual(50);
  });

  it('has unique ids and uses every category', () => {
    const ids = set.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(set.questions.map((question) => question.category))).toEqual(
      new Set(DOCUMENT_QUESTION_CATEGORIES),
    );
  });

  it('points every expected locator at a chunk that contains its anchor', () => {
    for (const question of set.questions) {
      for (const expected of question.expected) {
        const found = chunksOf(expected.path).some(
          (chunk) =>
            hitsTarget(
              { relativePath: expected.path, locator: chunk.locator },
              expected,
            ) && chunk.content.includes(expected.anchor),
        );
        expect({ id: question.id, found }).toEqual({
          id: question.id,
          found: true,
        });
      }
    }
  });

  describe('loading', () => {
    let box: Sandbox;
    beforeEach(() => {
      box = createSandbox('caa-document-questions-');
      mkdirSync(join(box.root, DOCUMENT_EVAL_FOLDER), { recursive: true });
    });
    afterEach(() => box.dispose());

    it('rejects an expected location with a malformed locator', () => {
      writeFileSync(
        join(box.root, DOCUMENT_EVAL_FOLDER, DOCUMENT_QUESTIONS_FILE),
        JSON.stringify({
          version: 1,
          corpus: 'libs/server/testing/eval/documents/corpus',
          questions: [
            {
              id: 'x',
              category: 'workflow',
              question: 'q',
              expected: [
                {
                  path: 'a.md',
                  locator: { kind: 'section', headingPath: [] },
                  anchor: 'a',
                },
              ],
            },
          ],
        }),
      );
      expect(() => loadDocumentQuestionSet(box.root)).toThrow();
    });
  });
});

describe('document evaluation corpus', () => {
  it('is a documentation set of a realistic size', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.length).toBeLessThanOrEqual(40);
  });

  it.each(files)(
    '%s is a supported format, contains no secret-like text, and chunks',
    (path) => {
      expect(documentFormatFor(path)).toBeDefined();
      expect(
        containsSecret(
          readFileSync(join(corpusRoot, ...path.split('/')), 'utf8'),
        ),
      ).toBe(false);
      expect(chunksOf(path).length).toBeGreaterThan(0);
    },
  );
});
