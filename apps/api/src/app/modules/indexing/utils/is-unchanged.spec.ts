import { faker } from '@codebase-ai/shared-testing';
import { isUnchanged, type StoredFileIdentity } from './is-unchanged';

describe('isUnchanged', () => {
  const current = {
    contentHash: faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
      prefix: '',
    }),
    embeddingModel: `ollama/${faker.lorem.word()}`,
    chunkingVersion: 'markdown-1',
  };
  const stored = (
    overrides: Partial<StoredFileIdentity> = {},
  ): StoredFileIdentity => ({
    status: 'indexed',
    ...current,
    ...overrides,
  });

  it('is unchanged when an indexed row has the same hash and identity', () => {
    expect(isUnchanged(stored(), current)).toBe(true);
  });

  it('keeps a file skipped for its content after hashing unchanged', () => {
    expect(isUnchanged(stored({ status: 'skipped' }), current)).toBe(true);
  });

  it.each([
    ['no row', undefined],
    ['a failed row', stored({ status: 'failed' })],
    ['a skip without hash', stored({ status: 'skipped', contentHash: null })],
    ['another hash', stored({ contentHash: 'f'.repeat(64) })],
    ['another embedding identity', stored({ embeddingModel: 'other/model' })],
    ['another chunking version', stored({ chunkingVersion: 'markdown-0' })],
  ])('is changed with %s', (_, row) => {
    expect(isUnchanged(row, current)).toBe(false);
  });
});
