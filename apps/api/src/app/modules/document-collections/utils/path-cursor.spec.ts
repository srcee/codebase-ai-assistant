import { BadRequestException } from '@nestjs/common';
import { faker } from '@codebase-ai/shared-testing';
import { decodePathCursor, encodePathCursor } from './path-cursor';

describe('path cursor', () => {
  it('round-trips a path', () => {
    const path = `specs/${faker.system.fileName()}`.toLowerCase();
    expect(decodePathCursor(encodePathCursor(path))).toBe(path);
  });

  it.each([
    ['not base64 JSON', '%%%'],
    ['a number', Buffer.from('42').toString('base64url')],
    ['an empty path', encodePathCursor('')],
    ['an overlong path', encodePathCursor('a'.repeat(1025))],
  ])('rejects %s', (_label, value) => {
    expect(() => decodePathCursor(value)).toThrow(BadRequestException);
  });
});
