import { retrievedChunkFactory } from '../../../../testing/factories/search-candidate.factory';
import { termCoverage } from './term-coverage';

describe('termCoverage', () => {
  it('counts query terms found in the title, path, or content', () => {
    const chunk = retrievedChunkFactory.build({
      title: 'invoice',
      relativePath: 'src/billing/totals.ts',
      content: 'export function computeTotal() {}',
    });

    expect(termCoverage(['invoice', 'billing', 'total', 'refund'], chunk)).toBe(
      0.75,
    );
  });

  it('matches the parts of compound identifiers', () => {
    const chunk = retrievedChunkFactory.build({
      title: null,
      content: 'const retryLimit = 3;',
    });

    expect(termCoverage(['retry', 'limit'], chunk)).toBe(1);
  });

  it('is zero without query terms', () => {
    expect(termCoverage([], retrievedChunkFactory.build())).toBe(0);
  });
});
