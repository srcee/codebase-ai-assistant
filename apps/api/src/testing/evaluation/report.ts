import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ModeSummary, SEARCH_MODES, type SearchMode } from './metrics';

/** Settings that shape the results, so two reports can be compared; no content or secrets. */
export interface EvalConfigSnapshot {
  embeddingIdentity: string;
  embeddingQueryPrefix: string;
  embeddingDocumentPrefix: string;
  chunkMaxChars: number;
  chunkOverlapChars: number;
  chunkingVersion: string;
  candidateLimit: number;
  rrfK: number;
  hnswEfSearch: number;
}

export interface EvalIndexingSummary {
  filesDiscovered: number;
  filesIndexed: number;
  filesSkipped: number;
  filesFailed: number;
  chunksWritten: number;
  durationMs: number;
  coverage: number;
}

export interface EvalReport {
  label: string;
  generatedAt: string;
  questionSetVersion: number;
  questionCount: number;
  config: EvalConfigSnapshot;
  indexing: EvalIndexingSummary;
  modes: Record<SearchMode, ModeSummary>;
}

const LABEL = /^[a-z0-9][a-z0-9-]{0,63}$/;

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const decimal = (value: number): string => value.toFixed(3);
const millis = (value: number): string => `${Math.round(value)} ms`;

export function renderReportMarkdown(report: EvalReport): string {
  const { config, indexing } = report;
  const modes = SEARCH_MODES.map((mode) => [mode, report.modes[mode]] as const);
  const categories = Object.keys(report.modes.hybrid.byCategory);

  const lines = [
    `# Retrieval evaluation: ${report.label}`,
    '',
    `Generated ${report.generatedAt} from question set v${report.questionSetVersion} (${report.questionCount} questions).`,
    '',
    '## Results',
    '',
    '| Mode | Recall@5 | Recall@10 | MRR@10 | p50 | p95 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...modes.map(
      ([mode, summary]) =>
        `| ${mode} | ${percent(summary.recallAt5)} | ${percent(summary.recallAt10)} | ${decimal(summary.mrrAt10)} | ${millis(summary.latencyP50Ms)} | ${millis(summary.latencyP95Ms)} |`,
    ),
    '',
    '## Recall@10 by category',
    '',
    `| Category | Questions | ${modes.map(([mode]) => mode).join(' | ')} |`,
    `| --- | --- | ${modes.map(() => '---').join(' | ')} |`,
    ...categories.map((category) => {
      const key = category as keyof ModeSummary['byCategory'];
      const cells = modes.map(([, summary]) =>
        percent(summary.byCategory[key]?.recallAt10 ?? 0),
      );
      return `| ${category} | ${report.modes.hybrid.byCategory[key]?.questions ?? 0} | ${cells.join(' | ')} |`;
    }),
    '',
    '## Questions with a missed location in the top 10',
    '',
    ...modes.map(
      ([mode, summary]) =>
        `- ${mode}: ${summary.incomplete.length === 0 ? 'none' : summary.incomplete.join(', ')}`,
    ),
    '',
    '## Indexing',
    '',
    `- Files: ${indexing.filesIndexed} indexed of ${indexing.filesDiscovered} discovered (coverage ${percent(indexing.coverage)}), ${indexing.filesSkipped} skipped, ${indexing.filesFailed} failed`,
    `- Chunks: ${indexing.chunksWritten}`,
    `- Duration: ${millis(indexing.durationMs)}`,
    '',
    '## Configuration',
    '',
    `- Embedding identity: ${config.embeddingIdentity}`,
    `- Query prefix: ${JSON.stringify(config.embeddingQueryPrefix)}, document prefix: ${JSON.stringify(config.embeddingDocumentPrefix)}`,
    `- Chunks: up to ${config.chunkMaxChars} characters, ${config.chunkOverlapChars} overlap, chunking version ${config.chunkingVersion}`,
    `- Candidates per search: ${config.candidateLimit}, RRF k: ${config.rrfK}, HNSW ef_search: ${config.hnswEfSearch}`,
    '',
  ];
  return lines.join('\n');
}

/** The label becomes a file name, so it cannot carry a path. */
export function writeReport(report: EvalReport, directory: string): string[] {
  if (!LABEL.test(report.label)) {
    throw new Error(
      'Report label must be lower-case letters, digits and dashes',
    );
  }
  mkdirSync(directory, { recursive: true });
  const json = join(directory, `${report.label}.json`);
  const markdown = join(directory, `${report.label}.md`);
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdown, renderReportMarkdown(report));
  return [json, markdown];
}
