import { NotFoundException } from '@nestjs/common';
import type { IndexJobResponse } from '@codebase-ai/contracts';
import { faker } from '@codebase-ai/shared-testing';
import type { ProjectScopeService } from '../../projects/services/project-scope.service';
import type { IndexJobRunnerService } from './index-job-runner.service';
import { ProjectSyncService } from './project-sync.service';

describe('ProjectSyncService', () => {
  const job = (sourceId: string) =>
    ({ id: faker.string.uuid(), sourceId }) as IndexJobResponse;

  const serviceFor = (
    sourceIds: string[],
    trySync: IndexJobRunnerService['trySync'],
  ) =>
    new ProjectSyncService(
      {
        resolveSourceIds: async () => sourceIds,
      } as unknown as ProjectScopeService,
      { trySync } as unknown as IndexJobRunnerService,
    );

  it('skips a source deleted since the project was read', async () => {
    const [kept, deleted] = [faker.string.uuid(), faker.string.uuid()];
    const started = job(kept);
    const service = serviceFor([kept, deleted], async (sourceId) => {
      if (sourceId === deleted) throw new NotFoundException();
      return { job: started, alreadyActive: false };
    });

    await expect(service.sync(faker.string.uuid())).resolves.toEqual({
      started: [started],
      alreadyActive: [],
    });
  });

  it('fails on any other error', async () => {
    const service = serviceFor([faker.string.uuid()], async () => {
      throw new Error('database down');
    });
    await expect(service.sync(faker.string.uuid())).rejects.toThrow(
      'database down',
    );
  });
});
