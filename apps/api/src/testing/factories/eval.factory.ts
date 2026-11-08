import { Factory } from 'fishery';
import { faker } from '@codebase-ai/shared-testing';
import type { ExpectedLocation } from '../evaluation/eval-questions';
import type {
  CategorySummary,
  ModeSummary,
  ResultLocation,
} from '../evaluation/metrics';
import type { EvalReport } from '../evaluation/report';

export const expectedLocationFactory = Factory.define<ExpectedLocation>(() => ({
  path: `src/${faker.word.noun()}.ts`,
  startLine: 10,
  endLine: 20,
  anchor: faker.word.noun(),
}));

export const resultLocationFactory = Factory.define<ResultLocation>(() => ({
  relativePath: `src/${faker.word.noun()}.ts`,
  startLine: 10,
  endLine: 20,
}));

const categorySummaryFactory = Factory.define<CategorySummary>(() => ({
  questions: faker.number.int({ min: 1, max: 10 }),
  recallAt10: faker.number.float({ min: 0, max: 1 }),
  mrrAt10: faker.number.float({ min: 0, max: 1 }),
}));

export const modeSummaryFactory = Factory.define<ModeSummary>(() => ({
  recallAt5: faker.number.float({ min: 0, max: 1 }),
  recallAt10: faker.number.float({ min: 0, max: 1 }),
  mrrAt10: faker.number.float({ min: 0, max: 1 }),
  latencyP50Ms: faker.number.int({ min: 1, max: 200 }),
  latencyP95Ms: faker.number.int({ min: 200, max: 900 }),
  byCategory: {
    identifier: categorySummaryFactory.build(),
    paraphrase: categorySummaryFactory.build(),
  },
  incomplete: [],
}));

export const evalReportFactory = Factory.define<EvalReport>(() => ({
  label: `run-${faker.string.alphanumeric({ length: 6, casing: 'lower' })}`,
  generatedAt: faker.date.recent().toISOString(),
  questionSetVersion: 1,
  questionCount: faker.number.int({ min: 20, max: 50 }),
  config: {
    embeddingIdentity: `${faker.word.noun()}/${faker.word.noun()}`,
    embeddingQueryPrefix: '',
    embeddingDocumentPrefix: '',
    chunkMaxChars: 2000,
    chunkOverlapChars: 200,
    chunkingVersion: '3',
    candidateLimit: 40,
    rrfK: 60,
    hnswEfSearch: 100,
  },
  indexing: {
    filesDiscovered: 30,
    filesIndexed: 30,
    filesSkipped: 0,
    filesFailed: 0,
    chunksWritten: faker.number.int({ min: 40, max: 80 }),
    durationMs: faker.number.int({ min: 500, max: 5000 }),
    coverage: 1,
  },
  modes: {
    vector: modeSummaryFactory.build(),
    lexical: modeSummaryFactory.build(),
    hybrid: modeSummaryFactory.build(),
  },
}));
