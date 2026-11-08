import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSandbox, type Sandbox } from '@codebase-ai/server-testing';
import { evalReportFactory } from '../factories/eval.factory';
import { renderReportMarkdown, writeReport } from './report';

describe('retrieval evaluation report', () => {
  let box: Sandbox;

  beforeEach(() => {
    box = createSandbox('caa-eval-report-');
  });
  afterEach(() => box.dispose());

  describe('renderReportMarkdown', () => {
    it('lists every mode with its metrics and the configuration', () => {
      const report = evalReportFactory.build();
      const markdown = renderReportMarkdown(report);

      expect(markdown).toContain(`# Retrieval evaluation: ${report.label}`);
      for (const mode of ['vector', 'lexical', 'hybrid'] as const) {
        const { recallAt10 } = report.modes[mode];
        expect(markdown).toContain(
          `| ${mode} | ${(report.modes[mode].recallAt5 * 100).toFixed(1)}% | ${(recallAt10 * 100).toFixed(1)}% |`,
        );
      }
      expect(markdown).toContain(
        `- Embedding identity: ${report.config.embeddingIdentity}`,
      );
      expect(markdown).toContain('| identifier |');
      expect(markdown).toContain('| paraphrase |');
    });

    it('names the questions that missed a location', () => {
      const report = evalReportFactory.build();
      report.modes.vector.incomplete = ['paraphrase-02', 'identifier-04'];

      const markdown = renderReportMarkdown(report);

      expect(markdown).toContain('- vector: paraphrase-02, identifier-04');
      expect(markdown).toContain('- lexical: none');
    });
  });

  describe('writeReport', () => {
    it('writes the JSON and Markdown files named after the label', () => {
      const report = evalReportFactory.build();
      const directory = join(box.path, 'reports');

      const [json, markdown] = writeReport(report, directory);

      expect(json).toBe(join(directory, `${report.label}.json`));
      expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual(report);
      expect(readFileSync(markdown, 'utf8')).toBe(renderReportMarkdown(report));
    });

    it('reuses an existing directory', () => {
      const directory = join(box.path, 'reports');
      mkdirSync(directory);
      writeReport(evalReportFactory.build({ label: 'again' }), directory);
      expect(existsSync(join(directory, 'again.json'))).toBe(true);
    });

    it.each(['../escape', 'Upper', 'with space', '', 'a/b', '-leading'])(
      'rejects the label %j',
      (label) => {
        expect(() =>
          writeReport(evalReportFactory.build({ label }), box.path),
        ).toThrow('Report label');
      },
    );
  });
});
