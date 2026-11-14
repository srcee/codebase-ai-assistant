import { BadRequestException, NotFoundException } from '@nestjs/common';
import { faker } from '@codebase-ai/shared-testing';
import type { ProjectScopeService } from '../../projects/services/project-scope.service';
import { SearchScopeService } from './search-scope.service';

describe('SearchScopeService', () => {
  const projectScope = { resolveSourceIds: jest.fn() };
  const service = () =>
    new SearchScopeService(projectScope as unknown as ProjectScopeService);

  beforeEach(() => projectScope.resolveSourceIds.mockReset());

  it('returns the given source ids', async () => {
    const sourceIds = [faker.string.uuid()];
    await expect(service().resolve({ sourceIds })).resolves.toEqual(sourceIds);
    expect(projectScope.resolveSourceIds).not.toHaveBeenCalled();
  });

  it('resolves a project to its sources', async () => {
    const projectId = faker.string.uuid();
    const sourceIds = [faker.string.uuid(), faker.string.uuid()];
    projectScope.resolveSourceIds.mockResolvedValue(sourceIds);

    await expect(service().resolve({ projectId })).resolves.toEqual(sourceIds);
    expect(projectScope.resolveSourceIds).toHaveBeenCalledWith(projectId);
  });

  it.each([
    [
      'both scopes',
      { sourceIds: [faker.string.uuid()], projectId: faker.string.uuid() },
    ],
    ['no scope', {}],
  ])('rejects %s', async (_label, request) => {
    await expect(service().resolve(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(projectScope.resolveSourceIds).not.toHaveBeenCalled();
  });

  it('propagates an unknown project', async () => {
    projectScope.resolveSourceIds.mockRejectedValue(new NotFoundException());
    await expect(
      service().resolve({ projectId: faker.string.uuid() }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
