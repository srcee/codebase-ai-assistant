import {
  expectedLocationFactory,
  resultLocationFactory,
} from '../factories/eval.factory';
import {
  hitsTarget,
  isHit,
  linesTarget,
  percentile,
  recallAtK,
  reciprocalRank,
  scoreQuestion,
  summarizeScores,
} from './metrics';

const expected = expectedLocationFactory.build({
  path: 'src/a.ts',
  startLine: 20,
  endLine: 30,
});
const target = linesTarget(expected);
const linesAt = (relativePath: string, startLine: number, endLine: number) =>
  resultLocationFactory.build({
    relativePath,
    locator: { kind: 'lines', startLine, endLine },
  });
const hit = linesAt('src/a.ts', 25, 40);
const miss = () => resultLocationFactory.build();

describe('isHit', () => {
  it.each([
    ['inside', 22, 28],
    ['overlapping the start', 10, 20],
    ['overlapping the end', 30, 45],
    ['covering the range', 1, 100],
  ])('hits a result %s the expected range', (_label, startLine, endLine) => {
    expect(isHit(linesAt('src/a.ts', startLine, endLine), expected)).toBe(true);
  });

  it.each([
    ['before', 1, 19],
    ['after', 31, 50],
  ])('misses a result %s the expected range', (_label, startLine, endLine) => {
    expect(isHit(linesAt('src/a.ts', startLine, endLine), expected)).toBe(
      false,
    );
  });

  it('misses the same lines in another file', () => {
    expect(isHit({ ...hit, relativePath: 'src/other.ts' }, expected)).toBe(
      false,
    );
  });

  it('misses a result in the same file without a line locator', () => {
    expect(
      isHit(
        resultLocationFactory.build({
          relativePath: 'src/a.ts',
          locator: { kind: 'page', page: 1 },
        }),
        expected,
      ),
    ).toBe(false);
  });
});

describe('hitsTarget', () => {
  const section = {
    path: 'docs/roles.md',
    locator: { kind: 'section' as const, headingPath: ['Roles', 'Reviewer'] },
  };

  it('hits the same section of the same document', () => {
    expect(
      hitsTarget(
        { relativePath: 'docs/roles.md', locator: section.locator },
        section,
      ),
    ).toBe(true);
  });

  it('misses another section or another document', () => {
    expect(
      hitsTarget(
        {
          relativePath: 'docs/roles.md',
          locator: { kind: 'section', headingPath: ['Roles'] },
        },
        section,
      ),
    ).toBe(false);
    expect(
      hitsTarget(
        { relativePath: 'docs/other.md', locator: section.locator },
        section,
      ),
    ).toBe(false);
  });

  it('hits table rows whose range overlaps the expected rows', () => {
    const rows = {
      path: 'docs/permissions.md',
      locator: {
        kind: 'table_rows' as const,
        tableIndex: 1,
        rowStart: 4,
        rowEnd: 4,
        columns: [],
      },
    };
    expect(
      hitsTarget(
        {
          relativePath: 'docs/permissions.md',
          locator: { ...rows.locator, rowStart: 2, rowEnd: 6 },
        },
        rows,
      ),
    ).toBe(true);
    expect(
      hitsTarget(
        {
          relativePath: 'docs/permissions.md',
          locator: { ...rows.locator, tableIndex: 2, rowStart: 2, rowEnd: 6 },
        },
        rows,
      ),
    ).toBe(false);
  });
});

describe('recallAtK', () => {
  const second = linesTarget(
    expectedLocationFactory.build({
      path: 'src/b.ts',
      startLine: 1,
      endLine: 5,
    }),
  );
  const secondHit = linesAt('src/b.ts', 1, 9);

  it('is the fraction of expected locations found', () => {
    expect(recallAtK([hit, miss()], [target, second], 10)).toBe(0.5);
    expect(recallAtK([hit, secondHit], [target, second], 10)).toBe(1);
  });

  it('only looks at the top k results', () => {
    const results = [...Array.from({ length: 5 }, miss), hit];
    expect(recallAtK(results, [target], 5)).toBe(0);
    expect(recallAtK(results, [target], 10)).toBe(1);
  });

  it('counts a location once however many results hit it', () => {
    expect(recallAtK([hit, hit], [target, second], 10)).toBe(0.5);
  });

  it('is zero without results', () => {
    expect(recallAtK([], [target], 10)).toBe(0);
  });
});

describe('reciprocalRank', () => {
  it('is one over the rank of the first hit', () => {
    expect(reciprocalRank([hit], [target])).toBe(1);
    expect(reciprocalRank([miss(), miss(), hit], [target])).toBeCloseTo(1 / 3);
  });

  it('is zero without a hit or beyond the cutoff', () => {
    expect(reciprocalRank([miss()], [target])).toBe(0);
    expect(
      reciprocalRank([...Array.from({ length: 10 }, miss), hit], [target]),
    ).toBe(0);
  });
});

describe('scoreQuestion', () => {
  it('combines the metrics for one question', () => {
    expect(
      scoreQuestion(
        { id: 'q-1', category: 'identifier', targets: [target] },
        [miss(), hit],
        12,
      ),
    ).toEqual({
      id: 'q-1',
      category: 'identifier',
      recallAt5: 1,
      recallAt10: 1,
      reciprocalRank: 0.5,
      latencyMs: 12,
    });
  });
});

describe('percentile', () => {
  const values = [9, 1, 5, 3, 7, 2, 10, 4, 8, 6];

  it.each([
    [50, 5],
    [95, 10],
    [10, 1],
    [100, 10],
  ])('p%d of ten values is %d', (p, result) => {
    expect(percentile(values, p)).toBe(result);
  });

  it('handles empty and single inputs', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([7], 95)).toBe(7);
  });

  it('does not reorder the input', () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('summarizeScores', () => {
  const score = (
    id: string,
    category: 'identifier' | 'paraphrase',
    recallAt10: number,
    reciprocalRankValue: number,
    latencyMs: number,
  ) => ({
    id,
    category,
    recallAt5: recallAt10,
    recallAt10,
    reciprocalRank: reciprocalRankValue,
    latencyMs,
  });

  it('averages overall and per category and lists incomplete questions', () => {
    const summary = summarizeScores([
      score('a', 'identifier', 1, 1, 10),
      score('b', 'identifier', 0.5, 0.5, 20),
      score('c', 'paraphrase', 0, 0, 30),
    ]);

    expect(summary.recallAt10).toBeCloseTo(0.5);
    expect(summary.mrrAt10).toBeCloseTo(0.5);
    expect(summary.latencyP50Ms).toBe(20);
    expect(summary.latencyP95Ms).toBe(30);
    expect(summary.byCategory).toEqual({
      identifier: { questions: 2, recallAt10: 0.75, mrrAt10: 0.75 },
      paraphrase: { questions: 1, recallAt10: 0, mrrAt10: 0 },
    });
    expect(summary.incomplete).toEqual(['b', 'c']);
  });

  it('is all zero for no scores', () => {
    expect(summarizeScores([])).toMatchObject({
      recallAt5: 0,
      recallAt10: 0,
      mrrAt10: 0,
      latencyP50Ms: 0,
      byCategory: {},
      incomplete: [],
    });
  });
});
