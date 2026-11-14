import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSandbox, type Sandbox } from '@codebase-ai/server-testing';
import { chatEvalReportFactory } from '../factories/chat-eval.factory';
import { renderChatReportMarkdown, writeChatReport } from './chat-report';

describe('chat evaluation report', () => {
  let box: Sandbox;

  beforeEach(() => {
    box = createSandbox('caa-chat-report-');
  });
  afterEach(() => box.dispose());

  it('renders the metrics and one review row per answer', () => {
    const report = chatEvalReportFactory.build();
    report.answers[0].answer = 'Line one\nwith | pipe';
    report.answers[1].abstained = true;

    const markdown = renderChatReportMarkdown(report);

    expect(markdown).toContain(`# Chat evaluation: ${report.label}`);
    expect(markdown).toContain(
      `| Citation validity | ${(report.summary.citationValidity * 100).toFixed(1)}% |`,
    );
    expect(markdown).toContain('Line one with \\| pipe');
    expect(markdown).toContain(`| ${report.answers[1].id} | abstained |`);
  });

  it('writes JSON and Markdown named after the label', () => {
    const report = chatEvalReportFactory.build();

    const [json, markdown] = writeChatReport(report, join(box.path, 'reports'));

    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual(report);
    expect(markdown.endsWith(`chat-${report.label}.md`)).toBe(true);
  });

  it('rejects a label that could escape the directory', () => {
    const report = chatEvalReportFactory.build({ label: '../x' });
    expect(() => writeChatReport(report, box.path)).toThrow(/label/);
  });
});
