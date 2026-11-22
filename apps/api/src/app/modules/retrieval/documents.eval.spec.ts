import { cpSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type {
  DocumentCollectionResponse,
  LatestIndexJobResponse,
} from '@codebase-ai/contracts';
import { type AppConfig, loadConfig } from '@codebase-ai/server-config';
import type { DatabaseHandle } from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  prepareDedicatedDatabase,
} from '@codebase-ai/server-database/testing';
import { createSandbox, type Sandbox } from '@codebase-ai/server-testing';
import { authorizedAgent } from '../../../testing/authorized-agent';
import { createTestApp } from '../../../testing/create-test-app';
import {
  DOCUMENT_EVAL_FOLDER,
  loadDocumentQuestionSet,
} from '../../../testing/evaluation/document-questions';
import { evalRoot } from '../../../testing/evaluation/eval-root';
import {
  type ModeSummary,
  type QuestionScore,
  type ResultLocation,
  scoreQuestion,
  SEARCH_MODES,
  type SearchMode,
  summarizeScores,
} from '../../../testing/evaluation/metrics';
import {
  type EvalReport,
  writeReport,
} from '../../../testing/evaluation/report';
import { DOCUMENT_CHUNKING_VERSIONS } from '../document-ingestion/constants/chunking-versions';
import { EmbeddingsService } from '../embeddings/services/embeddings.service';
import { IndexJobRunnerService } from '../indexing/services/index-job-runner.service';
import { LexicalSearchService } from './services/lexical-search.service';
import { RetrievalService } from './services/retrieval.service';
import { VectorSearchService } from './services/vector-search.service';

// Opt-in: needs the local embedding runtime and TEST_DATABASE_URL.
const enabled = process.env['RUN_DOCUMENT_EVAL'] === 'true';

if (!enabled) {
  describe.skip('document retrieval evaluation (set RUN_DOCUMENT_EVAL=true)', () => {
    it('runs only on request', () => undefined);
  });
} else {
  jest.setTimeout(900_000);

  describeWithDatabase('document retrieval evaluation', (baseUrl) => {
    let app: INestApplication;
    let handle: DatabaseHandle;
    let box: Sandbox;
    let config: AppConfig;
    let collectionId: string;
    let indexing: LatestIndexJobResponse['job'];

    // Document reports sit next to the code reports under their own prefix.
    const label = `documents-${process.env['EVAL_LABEL'] ?? 'baseline'}`;

    beforeAll(async () => {
      box = createSandbox('caa-document-eval-');
      const prepared = await prepareDedicatedDatabase(baseUrl, 'document_eval');
      handle = prepared.handle;
      // Tunables come from the environment; the result window is fixed so Recall@10 is measurable.
      config = loadConfig({
        ...process.env,
        DATABASE_URL: prepared.url,
        ALLOWED_DOCUMENT_ROOTS: box.root,
        RETRIEVAL_MAX_CHUNKS: '10',
        RETRIEVAL_MAX_CONTEXT_CHARS: '200000',
        RETRIEVAL_DEBUG_ENDPOINT: 'false',
      });
      app = await createTestApp({ config });

      const folder = join(box.root, 'harbor-docs');
      cpSync(join(evalRoot(), DOCUMENT_EVAL_FOLDER, 'corpus'), folder, {
        recursive: true,
      });
      const api = authorizedAgent(app);
      const registered = await api
        .post('/document-collections')
        .send({ name: 'Harbor Shop docs', origin: 'folder', path: folder })
        .expect(201);
      collectionId = (registered.body as DocumentCollectionResponse).id;

      await api.post(`/document-collections/${collectionId}/sync`).expect(202);
      await app.get(IndexJobRunnerService, { strict: false }).whenIdle();
      const latest = await api
        .get(`/document-collections/${collectionId}/index-jobs/latest`)
        .expect(200);
      indexing = (latest.body as LatestIndexJobResponse).job;
    });

    afterAll(async () => {
      await app?.close();
      await handle?.pool.end();
      box?.dispose();
    });

    it('indexes every document of the corpus', () => {
      expect(indexing).toMatchObject({
        status: 'succeeded',
        filesSkipped: 0,
        filesFailed: 0,
      });
      expect(indexing.filesIndexed).toBe(indexing.filesDiscovered);
    });

    it('scores each search mode over the document questions and writes the report', async () => {
      const embeddings = app.get(EmbeddingsService, { strict: false });
      const vectorSearch = app.get(VectorSearchService, { strict: false });
      const lexicalSearch = app.get(LexicalSearchService, { strict: false });
      const retrieval = app.get(RetrievalService, { strict: false });
      const sourceIds = [collectionId];

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

      const set = loadDocumentQuestionSet();
      const modes = {} as Record<SearchMode, ModeSummary>;
      for (const mode of SEARCH_MODES) {
        const scores: QuestionScore[] = [];
        for (const question of set.questions) {
          const started = performance.now();
          const results = await searchers[mode](question.question);
          scores.push(
            scoreQuestion(
              { ...question, targets: question.expected },
              results,
              performance.now() - started,
            ),
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
          chunkingVersion: Object.values(DOCUMENT_CHUNKING_VERSIONS).join(', '),
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
      console.info(`Document retrieval evaluation report: ${files.join(', ')}`);

      expect(modes.hybrid.recallAt10).toBeGreaterThan(0);
    });
  });
}
