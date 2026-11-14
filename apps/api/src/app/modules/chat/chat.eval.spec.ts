import { cpSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type {
  ChatDoneEvent,
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
import {
  type ChatAnswerScore,
  scoreChatAnswer,
  summarizeChat,
} from '../../../testing/evaluation/chat-metrics';
import { loadChatQuestionSet } from '../../../testing/evaluation/chat-questions';
import {
  type ChatEvalReport,
  writeChatReport,
} from '../../../testing/evaluation/chat-report';
import { evalRoot } from '../../../testing/evaluation/eval-root';
import type { ExpectedLocation } from '../../../testing/evaluation/eval-questions';
import { loadQuestionSet } from '../../../testing/evaluation/eval-questions';
import {
  bufferEventStream,
  parseEventStream,
} from '../../../testing/event-stream';
import { EmbeddingsService } from '../embeddings/services/embeddings.service';
import { IndexJobRunnerService } from '../indexing/services/index-job-runner.service';
import { CHUNKING_VERSION } from '../ingestion/constants/chunking-version';

// Opt-in: needs the local embedding and chat models and TEST_DATABASE_URL.
const enabled = process.env['RUN_CHAT_EVAL'] === 'true';

if (!enabled) {
  describe.skip('chat evaluation (set RUN_CHAT_EVAL=true)', () => {
    it('runs only on request', () => undefined);
  });
} else {
  jest.setTimeout(3_600_000);

  describeWithDatabase('chat evaluation', (baseUrl) => {
    let app: INestApplication;
    let handle: DatabaseHandle;
    let box: Sandbox;
    let config: AppConfig;
    let codebaseId: string;

    const label = process.env['EVAL_LABEL'] ?? 'baseline';

    beforeAll(async () => {
      box = createSandbox('caa-chat-eval-');
      const prepared = await prepareDedicatedDatabase(baseUrl, 'chat_eval');
      handle = prepared.handle;
      // Chat and retrieval tunables come from the environment, so a tuning run is the same command.
      config = loadConfig({
        ...process.env,
        DATABASE_URL: prepared.url,
        ALLOWED_REPO_ROOTS: box.root,
        CHAT_GENERATION_TIMEOUT_MS:
          process.env['CHAT_GENERATION_TIMEOUT_MS'] ?? '600000',
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
      expect((latest.body as LatestIndexJobResponse).job.status).toBe(
        'succeeded',
      );
    });

    afterAll(async () => {
      await app?.close();
      await handle?.pool.end();
      box?.dispose();
    });

    it('scores answers, citations, and abstention and writes the report', async () => {
      const chatSet = loadChatQuestionSet();
      const questions: {
        id: string;
        question: string;
        expected?: ExpectedLocation[];
      }[] = [...loadQuestionSet().questions, ...chatSet.unanswerable];

      const answers: ChatAnswerScore[] = [];
      for (const question of questions) {
        const started = performance.now();
        const response = await bufferEventStream(
          authorizedAgent(app)
            .post('/chat')
            .send({ question: question.question, sourceIds: [codebaseId] }),
        );
        expect(response.status).toBe(200);
        const done = parseEventStream(response.body as string).find(
          (event) => event.event === 'done',
        );
        if (!done) throw new Error(`No answer for ${question.id}`);
        answers.push(
          scoreChatAnswer(
            question,
            done.data as ChatDoneEvent,
            performance.now() - started,
          ),
        );
      }

      const report: ChatEvalReport = {
        label,
        generatedAt: new Date().toISOString(),
        questionSetVersion: chatSet.version,
        chatModel: config.inference.chatModel,
        config: {
          embeddingIdentity: app.get(EmbeddingsService, { strict: false })
            .identity,
          embeddingQueryPrefix: config.inference.embeddingQueryPrefix,
          embeddingDocumentPrefix: config.inference.embeddingDocumentPrefix,
          chunkMaxChars: config.ingestion.chunkMaxChars,
          chunkOverlapChars: config.ingestion.chunkOverlapChars,
          chunkingVersion: CHUNKING_VERSION,
          candidateLimit: config.retrieval.candidateLimit,
          rrfK: config.retrieval.rrfK,
          hnswEfSearch: config.retrieval.hnswEfSearch,
          minVectorSimilarity: config.chat.minVectorSimilarity,
          maxChunks: config.retrieval.maxChunks,
          maxContextChars: config.retrieval.maxContextChars,
        },
        summary: summarizeChat(answers),
        answers,
      };

      const files = writeChatReport(report, join(evalRoot(), 'reports'));
      console.info(`Chat evaluation report: ${files.join(', ')}`);

      expect(report.summary.answerable).toBeGreaterThan(0);
    });
  });
}
