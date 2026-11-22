import type { SkippedEntry } from '../../ingestion/types/discovery-entry';
import type { FileOutcome } from '../types/file-outcome';
import { workItems } from './work-items';

async function* entriesOf<T>(...entries: T[]): AsyncGenerator<T> {
  yield* entries;
}

describe('workItems', () => {
  it('maps included files to the indexer and skipped entries to the skip recorder', async () => {
    const included = {
      status: 'included' as const,
      relativePath: 'specs/roles.md',
    };
    const skippedFile: SkippedEntry = {
      status: 'skipped',
      relativePath: '.env',
      kind: 'file',
      reason: 'secret-filename',
    };
    const skippedDirectory: SkippedEntry = {
      status: 'skipped',
      relativePath: 'node_modules',
      kind: 'directory',
      reason: 'excluded-path',
    };
    const index = jest.fn(
      async (): Promise<FileOutcome> => ({
        kind: 'indexed',
        chunksWritten: 1,
      }),
    );
    const recordSkipped = jest.fn(
      async (): Promise<FileOutcome> => ({
        kind: 'skipped',
      }),
    );

    const items = [];
    for await (const item of workItems(
      entriesOf<typeof included | SkippedEntry>(
        included,
        skippedFile,
        skippedDirectory,
      ),
      index,
      recordSkipped,
    )) {
      items.push(item);
    }

    expect(
      items.map(({ relativePath, isDirectory }) => [relativePath, isDirectory]),
    ).toEqual([
      ['specs/roles.md', false],
      ['.env', false],
      ['node_modules', true],
    ]);
    await expect(items[0].process()).resolves.toEqual({
      kind: 'indexed',
      chunksWritten: 1,
    });
    await expect(items[1].process()).resolves.toEqual({ kind: 'skipped' });
    expect(index).toHaveBeenCalledWith(included);
    expect(recordSkipped).toHaveBeenCalledWith(skippedFile);
  });
});
