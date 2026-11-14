import { and, cosineDistance, eq, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DatabaseHandle,
  schema,
} from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  prepareDedicatedDatabase,
  sourceFactory,
  sourceFileFactory,
} from '@codebase-ai/server-database/testing';
import { testConfig } from '@codebase-ai/server-testing';
import { percentile } from '../../../testing/evaluation/metrics';
import { VectorSearchService } from './services/vector-search.service';

const { chunks } = schema;

// Opt-in: builds a large table and several HNSW indexes. HNSW_BENCH_CHUNKS and HNSW_BENCH_QUERIES resize it.
const enabled = process.env['RUN_HNSW_BENCHMARK'] === 'true';

const DIMENSIONS = 768;
const REPOSITORIES = 4;
const CLUSTERS = 200;
const TOP = 10;
const EF_SEARCH_VALUES = [40, 100, 200, 400];
const VARIANTS = [
  { name: 'm=16, ef_construction=64 (pgvector default)', m: 16, efc: 64 },
  { name: 'm=32, ef_construction=128', m: 32, efc: 128 },
];
const MODEL = 'benchmark/model';

/** Deterministic, so every run measures the same data. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gaussian = (next: () => number): number =>
  Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());

const normalize = (vector: number[]): number[] => {
  const length = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );
  return vector.map((value) => value / length);
};

if (!enabled) {
  describe.skip('HNSW benchmark (set RUN_HNSW_BENCHMARK=true)', () => {
    it('runs only on request', () => undefined);
  });
} else {
  jest.setTimeout(3_600_000);

  describeWithDatabase('HNSW benchmark', (baseUrl) => {
    const chunkCount = Number(process.env['HNSW_BENCH_CHUNKS'] ?? 20000);
    const queryCount = Number(process.env['HNSW_BENCH_QUERIES'] ?? 100);
    let handle: DatabaseHandle;
    let database: DatabaseService;
    let url: string;
    const repositoryIds: string[] = [];

    const next = random(42);
    const centers = Array.from({ length: CLUSTERS }, () =>
      normalize(Array.from({ length: DIMENSIONS }, () => gaussian(next))),
    );
    // Noise of norm 0.6 around a unit centre gives clusters like real embeddings, not uniform noise.
    const sigma = 0.6 / Math.sqrt(DIMENSIONS);
    const sample = (): number[] => {
      const center = centers[Math.floor(next() * CLUSTERS)];
      return normalize(center.map((value) => value + sigma * gaussian(next)));
    };

    const config = (efSearch: number) =>
      testConfig({
        DATABASE_URL: url,
        RETRIEVAL_CANDIDATE_LIMIT: String(TOP),
        RETRIEVAL_MAX_CHUNKS: String(TOP),
        RETRIEVAL_HNSW_EF_SEARCH: String(efSearch),
      });

    // The planner may ignore the index, so this forces it to measure the index itself.
    const hnswIds = (
      vector: number[],
      repositoryId: string,
      efSearch: number,
    ) =>
      handle.db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('enable_sort', 'off', true), set_config('enable_seqscan', 'off', true), set_config('enable_bitmapscan', 'off', true), set_config('hnsw.iterative_scan', 'relaxed_order', true), set_config('hnsw.ef_search', ${String(efSearch)}, true)`,
        );
        const rows = await tx
          .select({ id: chunks.id })
          .from(chunks)
          .where(
            and(
              eq(chunks.sourceId, repositoryId),
              eq(chunks.embeddingModel, MODEL),
            ),
          )
          .orderBy(cosineDistance(chunks.embedding, vector))
          .limit(TOP);
        return rows.map((row) => row.id);
      });

    const timed = async <T>(work: () => Promise<T>) => {
      const started = performance.now();
      const result = await work();
      return { result, ms: performance.now() - started };
    };

    /** One untimed pass first, so cold caches do not count. */
    const measure = async (
      queries: { vector: number[]; repositoryId: string }[],
      search: (query: {
        vector: number[];
        repositoryId: string;
      }) => Promise<string[]>,
    ) => {
      for (const query of queries) await search(query);
      const ids: string[][] = [];
      const times: number[] = [];
      for (const query of queries) {
        const { result, ms } = await timed(() => search(query));
        ids.push(result);
        times.push(ms);
      }
      return { ids, times };
    };

    const summary = (times: number[], ids?: string[][], truth?: string[][]) => {
      const latency = `p50 ${percentile(times, 50).toFixed(1)} ms, p95 ${percentile(times, 95).toFixed(1)} ms`;
      if (!ids || !truth) return latency;
      const recall =
        ids.reduce(
          (sum, found, index) =>
            sum + truth[index].filter((id) => found.includes(id)).length / TOP,
          0,
        ) / ids.length;
      return `recall@${TOP} ${(recall * 100).toFixed(1)}%, ${latency}`;
    };

    beforeAll(async () => {
      const prepared = await prepareDedicatedDatabase(baseUrl, 'bench');
      handle = prepared.handle;
      url = prepared.url;
      database = new DatabaseService(config(100));
      const context = { transient: { db: handle.db } };

      await handle.pool.query('drop index chunks_embedding_hnsw_idx');
      const files: { id: string; sourceId: string }[] = [];
      for (let index = 0; index < REPOSITORIES; index++) {
        const repository = await sourceFactory.create({}, context);
        repositoryIds.push(repository.id);
        files.push(
          await sourceFileFactory.create({ sourceId: repository.id }, context),
        );
      }

      for (let start = 0; start < chunkCount; start += 500) {
        const batch = Array.from(
          { length: Math.min(500, chunkCount - start) },
          (_, offset) => ({
            file: files[(start + offset) % REPOSITORIES],
            hash: String(start + offset),
            embedding: JSON.stringify(sample()),
          }),
        );
        await handle.pool.query(
          `insert into chunks (source_id, file_id, chunk_hash, content_kind, locator, start_line, end_line, content, embedding, embedding_model, chunking_version)
           select r, f, h, 'code', '{"kind":"lines","startLine":1,"endLine":1}'::jsonb, 1, 1, 'x', e::vector, $5, '3'
           from unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[]) as t(r, f, h, e)`,
          [
            batch.map((row) => row.file.sourceId),
            batch.map((row) => row.file.id),
            batch.map((row) => row.hash),
            batch.map((row) => row.embedding),
            MODEL,
          ],
        );
      }
      await handle.pool.query('analyze chunks');
    });

    afterAll(async () => {
      await database?.onApplicationShutdown();
      await handle?.pool.end();
    });

    it('compares the production query without an index, with the planner choice, and with HNSW forced', async () => {
      const queries = Array.from({ length: queryCount }, (_, index) => ({
        vector: sample(),
        repositoryId: repositoryIds[index % REPOSITORIES],
      }));
      const production = (efSearch: number) => {
        const service = new VectorSearchService(database, config(efSearch));
        return async (query: { vector: number[]; repositoryId: string }) =>
          (
            await service.search({
              vector: query.vector,
              sourceIds: [query.repositoryId],
              embeddingModel: MODEL,
            })
          ).map((candidate) => candidate.chunkId);
      };

      // Without a vector index the query is exact, so it is the ground truth for recall.
      const exact = await measure(queries, production(100));
      const truth = exact.ids;

      const lines = [
        `HNSW benchmark: ${chunkCount} chunks, ${REPOSITORIES} repositories, ${queryCount} queries filtered to one repository, top ${TOP}`,
        `no vector index (exact): ${summary(exact.times)}`,
      ];

      for (const variant of VARIANTS) {
        const built = await timed(() =>
          handle.pool.query(
            `create index chunks_embedding_hnsw_idx on chunks using hnsw (embedding vector_cosine_ops) with (m = ${variant.m}, ef_construction = ${variant.efc})`,
          ),
        );
        const { rows } = await handle.pool.query<{ size: string }>(
          `select pg_size_pretty(pg_relation_size('chunks_embedding_hnsw_idx')) as size`,
        );
        await handle.pool.query('analyze chunks');
        const plan = await handle.pool.query(
          `explain select id from chunks where source_id = $1 and embedding_model = $2 order by embedding <=> $3::vector limit ${TOP}`,
          [repositoryIds[0], MODEL, JSON.stringify(queries[0].vector)],
        );
        const usesIndex = plan.rows.some((row) =>
          String(row['QUERY PLAN']).includes('hnsw'),
        );
        lines.push(
          '',
          `${variant.name}: build ${(built.ms / 1000).toFixed(1)} s, index size ${rows[0].size}, planner uses the index: ${usesIndex ? 'yes' : 'no'}`,
        );

        for (const efSearch of EF_SEARCH_VALUES) {
          const planner = await measure(queries, production(efSearch));
          const forced = await measure(queries, async (query) =>
            hnswIds(query.vector, query.repositoryId, efSearch),
          );
          lines.push(
            `  ef_search ${efSearch}: planner choice ${summary(planner.times, planner.ids, truth)}`,
            `  ef_search ${efSearch}: HNSW forced ${summary(forced.times, forced.ids, truth)}`,
          );
        }
        await handle.pool.query('drop index chunks_embedding_hnsw_idx');
      }

      console.info(lines.join('\n'));
      expect(truth.every((ids) => ids.length === TOP)).toBe(true);
    });
  });
}
