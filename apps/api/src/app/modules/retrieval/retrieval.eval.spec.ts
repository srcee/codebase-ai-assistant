import { cpSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type {
  CodebaseResponse,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { type AppConfig, loadConfig } from '@codebase-ai/server-config';
import type { DatabaseHandle } from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  prepareDedicatedDatabase,
} from '@codebase-ai/server-database/testing';
import {
  createSandbox,
  makeGitRepository,
  type Sandbox,
} from '@codebase-ai/server-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';
import { evalRoot } from '../../../testing/evaluation/eval-root';
import { loadQuestionSet } from '../../../testing/evaluation/eval-questions';
import {
  type ResultLocation,
  SEARCH_MODES,
  type ModeSummary,
  type QuestionScore,
  scoreQuestion,
  type SearchMode,
  summarizeScores,
} from '../../../testing/evaluation/metrics';
import {
  type EvalReport,
  writeReport,
} from '../../../testing/evaluation/report';
import { EmbeddingsService } from '../embeddings/services/embeddings.service';
import { IndexJobRunnerService } from '../indexing/services/index-job-runner.service';
import { CHUNKING_VERSION } from '../ingestion/constants/chunking-version';
import { LexicalSearchService } from './services/lexical-search.service';
import { RetrievalService } from './services/retrieval.service';
import { VectorSearchService } from './services/vector-search.service';

// Opt-in: needs the local embedding runtime and TEST_DATABASE_URL.
const enabled = process.env['RUN_RETRIEVAL_EVAL'] === 'true';

if (!enabled) {
  describe.skip('retrieval evaluation (set RUN_RETRIEVAL_EVAL=true)', () => {
    it('runs only on request', () => undefined);
  });
} else {
  jest.setTimeout(900_000);

  describeWithDatabase('retrieval evaluation', (baseUrl) => {
    let app: INestApplication;
    let handle: DatabaseHandle;
    let box: Sandbox;
    let config: AppConfig;
    let codebaseId: string;
    let indexing: LatestIndexJobResponse['job'];

    const label = process.env['EVAL_LABEL'] ?? 'baseline';

    beforeAll(async () => {
      box = createSandbox('caa-eval-');
      const prepared = await prepareDedicatedDatabase(baseUrl, 'eval');
      handle = prepared.handle;
      // Tunables come from the environment; the result window is fixed so Recall@10 is measurable.
      config = loadConfig({
        ...process.env,
        DATABASE_URL: prepared.url,
        ALLOWED_REPO_ROOTS: box.root,
        RETRIEVAL_MAX_CHUNKS: '10',
        RETRIEVAL_MAX_CONTEXT_CHARS: '200000',
        RETRIEVAL_DEBUG_ENDPOINT: 'false',
      });
      app = await createTestApp({ config });

      const repositoryPath = makeGitRepository(box.root, 'harbor-shop');
      cpSync(join(evalRoot(), 'corpus'), repositoryPath, { recursive: true });
      const api = authorizedAgent(app);
      const registered = await api
        .post('/codebases')
        .send({ path: repositoryPath })
        .expect(201);
      codebaseId = (registered.body as CodebaseResponse).id;

      await api.post(`/codebases/${codebaseId}/index`).expect(202);
      await app.get(IndexJobRunnerService, { strict: false }).whenIdle();
      const latest = await api
        .get(`/codebases/${codebaseId}/index-jobs/latest`)
        .expect(200);
      indexing = (latest.body as LatestIndexJobResponse).job;
    });

    afterAll(async () => {
      await app?.close();
      await handle?.pool.end();
      box?.dispose();
    });

    it('indexes every file of the corpus', () => {
      expect(indexing).toMatchObject({
        status: 'succeeded',
        filesSkipped: 0,
        filesFailed: 0,
      });
      expect(indexing.filesIndexed).toBe(indexing.filesDiscovered);
    });

    it('scores each search mode over the question set and writes the report', async () => {
      const embeddings = app.get(EmbeddingsService, { strict: false });
      const vectorSearch = app.get(VectorSearchService, { strict: false });
      const lexicalSearch = app.get(LexicalSearchService, { strict: false });
      const retrieval = app.get(RetrievalService, { strict: false });
      const sourceIds = [codebaseId];

      const searchers: Record<
        SearchMode,
        (question: string) => Promise<ResultLocation[]>
      > = {
        vector: async (question) =>
          vectorSearch.search({
            vector: await embeddings.embedQuery(question),
            sourceIds,
            embeddingModel: embeddings.identity,
          }),
        lexical: (question) => lexicalSearch.search(question, sourceIds),
        hybrid: (question) => retrieval.search({ query: question, sourceIds }),
      };

      // The first call loads the embedding model and would skew the latency of whichever mode runs first.
      await embeddings.embedQuery('warm up');

      const set = loadQuestionSet();
      const modes = {} as Record<SearchMode, ModeSummary>;
      for (const mode of SEARCH_MODES) {
        const scores: QuestionScore[] = [];
        for (const question of set.questions) {
          const started = performance.now();
          const results = await searchers[mode](question.question);
          scores.push(
            scoreQuestion(question, results, performance.now() - started),
          );
        }
        modes[mode] = summarizeScores(scores);
      }

      const report: EvalReport = {
        label,
        generatedAt: new Date().toISOString(),
        questionSetVersion: set.version,
        questionCount: set.questions.length,
        config: {
          embeddingIdentity: embeddings.identity,
          embeddingQueryPrefix: config.inference.embeddingQueryPrefix,
          embeddingDocumentPrefix: config.inference.embeddingDocumentPrefix,
          chunkMaxChars: config.ingestion.chunkMaxChars,
          chunkOverlapChars: config.ingestion.chunkOverlapChars,
          chunkingVersion: CHUNKING_VERSION,
          candidateLimit: config.retrieval.candidateLimit,
          rrfK: config.retrieval.rrfK,
          hnswEfSearch: config.retrieval.hnswEfSearch,
        },
        indexing: {
          filesDiscovered: indexing.filesDiscovered,
          filesIndexed: indexing.filesIndexed,
          filesSkipped: indexing.filesSkipped,
          filesFailed: indexing.filesFailed,
          chunksWritten: indexing.chunksWritten,
          durationMs:
            Date.parse(indexing.finishedAt ?? indexing.createdAt) -
            Date.parse(indexing.startedAt ?? indexing.createdAt),
          coverage: indexing.filesIndexed / indexing.filesDiscovered,
        },
        modes,
      };

      const files = writeReport(report, join(evalRoot(), 'reports'));
      console.info(`Retrieval evaluation report: ${files.join(', ')}`);

      expect(modes.hybrid.recallAt10).toBeGreaterThan(0);
    });
  });
}
