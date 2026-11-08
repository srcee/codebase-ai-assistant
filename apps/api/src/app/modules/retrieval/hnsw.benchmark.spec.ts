import { and, cosineDistance, eq, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DatabaseHandle,
  schema,
} from '@codebase-ai/server-database';
import {
  describeWithDatabase,
  prepareDedicatedDatabase,
  repositoryFactory,
  repositoryFileFactory,
} from '@codebase-ai/server-database/testing';
import { testConfig } from '@codebase-ai/server-testing';
import { percentile } from '../../../testing/evaluation/metrics';
import { VectorSearchService } from './services/vector-search.service';

const { codeChunks } = schema;

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

    const exactIds = (vector: number[], repositoryId: string) =>
      handle.db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('enable_indexscan', 'off', true)`,
        );
        const rows = await tx
          .select({ id: codeChunks.id })
          .from(codeChunks)
          .where(
            and(
              eq(codeChunks.repositoryId, repositoryId),
              eq(codeChunks.embeddingModel, MODEL),
            ),
          )
          .orderBy(cosineDistance(codeChunks.embedding, vector), codeChunks.id)
          .limit(TOP);
        return rows.map((row) => row.id);
      });

    const timed = async <T>(work: () => Promise<T>) => {
      const started = performance.now();
      const result = await work();
      return { result, ms: performance.now() - started };
    };

    beforeAll(async () => {
      const prepared = await prepareDedicatedDatabase(baseUrl, 'bench');
      handle = prepared.handle;
      url = prepared.url;
      database = new DatabaseService(config(100));
      const context = { transient: { db: handle.db } };

      await handle.pool.query('drop index code_chunks_embedding_hnsw_idx');
      const files: { id: string; repositoryId: string }[] = [];
      for (let index = 0; index < REPOSITORIES; index++) {
        const repository = await repositoryFactory.create({}, context);
        repositoryIds.push(repository.id);
        files.push(
          await repositoryFileFactory.create(
            { repositoryId: repository.id },
            context,
          ),
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
          `insert into code_chunks (repository_id, file_id, chunk_hash, start_line, end_line, content, embedding, embedding_model, chunking_version)
           select r, f, h, 1, 1, 'x', e::vector, $5, '3'
           from unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[]) as t(r, f, h, e)`,
          [
            batch.map((row) => row.file.repositoryId),
            batch.map((row) => row.file.id),
            batch.map((row) => row.hash),
            batch.map((row) => row.embedding),
            MODEL,
          ],
        );
      }
      await handle.pool.query('analyze code_chunks');
    });

    afterAll(async () => {
      await database?.onApplicationShutdown();
      await handle?.pool.end();
    });

    it('compares HNSW parameters with an exact scan on a repository-filtered query', async () => {
      const queries = Array.from({ length: queryCount }, (_, index) => ({
        vector: sample(),
        repositoryId: repositoryIds[index % REPOSITORIES],
      }));

      const truth: string[][] = [];
      const exactTimes: number[] = [];
      for (const query of queries) {
        const { result, ms } = await timed(() =>
          exactIds(query.vector, query.repositoryId),
        );
        truth.push(result);
        exactTimes.push(ms);
      }

      const lines = [
        `HNSW benchmark: ${chunkCount} chunks, ${REPOSITORIES} repositories, ${queryCount} queries filtered to one repository, top ${TOP}`,
        `exact scan: p50 ${percentile(exactTimes, 50).toFixed(1)} ms, p95 ${percentile(exactTimes, 95).toFixed(1)} ms`,
      ];

      for (const variant of VARIANTS) {
        const built = await timed(() =>
          handle.pool.query(
            `create index code_chunks_embedding_hnsw_idx on code_chunks using hnsw (embedding vector_cosine_ops) with (m = ${variant.m}, ef_construction = ${variant.efc})`,
          ),
        );
        const { rows } = await handle.pool.query<{ size: string }>(
          `select pg_size_pretty(pg_relation_size('code_chunks_embedding_hnsw_idx')) as size`,
        );
        await handle.pool.query('analyze code_chunks');
        const plan = await handle.pool.query(
          `explain select id from code_chunks where repository_id = $1 and embedding_model = $2 order by embedding <=> $3::vector limit ${TOP}`,
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
          const service = new VectorSearchService(database, config(efSearch));
          let recall = 0;
          const times: number[] = [];
          for (const [index, query] of queries.entries()) {
            const { result, ms } = await timed(() =>
              service.search({
                vector: query.vector,
                repositoryIds: [query.repositoryId],
                embeddingModel: MODEL,
              }),
            );
            times.push(ms);
            const found = new Set(result.map((candidate) => candidate.chunkId));
            recall += truth[index].filter((id) => found.has(id)).length / TOP;
          }
          lines.push(
            `  ef_search ${efSearch}: recall@${TOP} ${((recall / queries.length) * 100).toFixed(1)}%, p50 ${percentile(times, 50).toFixed(1)} ms, p95 ${percentile(times, 95).toFixed(1)} ms`,
          );
        }
        await handle.pool.query('drop index code_chunks_embedding_hnsw_idx');
      }

      console.info(lines.join('\n'));
      expect(truth.every((ids) => ids.length === TOP)).toBe(true);
    });
  });
}
