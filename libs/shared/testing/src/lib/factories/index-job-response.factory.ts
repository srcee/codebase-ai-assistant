import { Factory } from 'fishery';
import type { IndexJobResponse } from '@codebase-ai/contracts';
import { faker } from '../faker';

/** A finished, successful job by default; override `status` for others. */
export const indexJobResponseFactory = Factory.define<IndexJobResponse>(() => {
  const filesDiscovered = faker.number.int({ min: 1, max: 50 });
  const filesSkipped = faker.number.int({ min: 0, max: filesDiscovered });
  const createdAt = faker.date.recent();
  return {
    id: faker.string.uuid(),
    sourceId: faker.string.uuid(),
    status: 'succeeded',
    filesDiscovered,
    filesIndexed: filesDiscovered - filesSkipped,
    filesSkipped,
    filesFailed: 0,
    chunksWritten: faker.number.int({ min: 1, max: 500 }),
    errorSummary: null,
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    finishedAt: faker.date
      .between({ from: createdAt, to: new Date() })
      .toISOString(),
  };
});
