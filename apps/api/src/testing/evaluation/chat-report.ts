import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatAnswerScore, ChatSummary } from './chat-metrics';
import type { EvalConfigSnapshot } from './report';

export interface ChatEvalReport {
  label: string;
  generatedAt: string;
  questionSetVersion: number;
  chatModel: string;
  config: EvalConfigSnapshot & {
    minVectorSimilarity: number;
    maxChunks: number;
    maxContextChars: number;
  };
  summary: ChatSummary;
  answers: ChatAnswerScore[];
}

const LABEL = /^[a-z0-9][a-z0-9-]{0,63}$/;
const EXCERPT_CHARS = 160;

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const millis = (value: number): string => `${Math.round(value)} ms`;

const excerpt = (answer: string): string => {
  const line = answer.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return line.length > EXCERPT_CHARS
    ? `${line.slice(0, EXCERPT_CHARS - 1)}…`
    : line;
};

const outcome = (score: ChatAnswerScore): string =>
  score.abstained ? 'abstained' : score.declined ? 'declined' : 'answered';

export function renderChatReportMarkdown(report: ChatEvalReport): string {
  const { summary, config } = report;
  return [
    `# Chat evaluation: ${report.label}`,
    '',
    `Generated ${report.generatedAt} from chat question set v${report.questionSetVersion} (${summary.answerable} answerable, ${summary.unanswerable} unanswerable) with ${report.chatModel}.`,
    '',
    '## Results',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Citation validity | ${percent(summary.citationValidity)} |`,
    `| Answerable: answered with a valid citation | ${percent(summary.answeredWithCitation)} |`,
    `| Answerable: cited an expected location | ${percent(summary.expectedCited)} |`,
    `| Answerable: abstained or declined | ${percent(summary.falseAbstention)} |`,
    `| Unanswerable: abstained or declined | ${percent(summary.abstentionRecall)} |`,
    `| Unanswerable: abstained by the server | ${percent(summary.serverAbstentionRecall)} |`,
    `| Latency p50 / p95 | ${millis(summary.latencyP50Ms)} / ${millis(summary.latencyP95Ms)} |`,
    '',
    '## Groundedness review',
    '',
    'Fill in by hand: 2 = every claim is supported by the cited evidence, 1 = partly supported, 0 = unsupported or wrong.',
    '',
    '| Question | Outcome | Valid / invalid citations | Expected cited | Answer | Grounded (0-2) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.answers.map(
      (score) =>
        `| ${score.id} | ${outcome(score)} | ${score.validCitations} / ${score.invalidCitations} | ${score.answerable ? (score.citedExpected ? 'yes' : 'no') : 'n/a'} | ${excerpt(score.answer)} | |`,
    ),
    '',
    '## Configuration',
    '',
    `- Embedding identity: ${config.embeddingIdentity}`,
    `- Abstain below vector similarity ${config.minVectorSimilarity} without a lexical match`,
    `- Evidence: up to ${config.maxChunks} chunks and ${config.maxContextChars} characters; candidates ${config.candidateLimit}, RRF k ${config.rrfK}`,
    `- Chunks: up to ${config.chunkMaxChars} characters, chunking version ${config.chunkingVersion}`,
    '',
  ].join('\n');
}

/** The label becomes a file name, so it cannot carry a path. */
export function writeChatReport(
  report: ChatEvalReport,
  directory: string,
): string[] {
  if (!LABEL.test(report.label)) {
    throw new Error(
      'Report label must be lower-case letters, digits and dashes',
    );
  }
  mkdirSync(directory, { recursive: true });
  const json = join(directory, `chat-${report.label}.json`);
  const markdown = join(directory, `chat-${report.label}.md`);
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdown, renderChatReportMarkdown(report));
  return [json, markdown];
}
