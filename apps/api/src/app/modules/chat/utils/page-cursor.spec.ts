import { faker } from '@codebase-ai/shared-testing';
import { InvalidCursorError } from '../errors/invalid-cursor.error';
import { decodeCursor, encodeCursor } from './page-cursor';

describe('page cursor', () => {
  it('round-trips the time and id', () => {
    const cursor = { at: faker.date.past(), id: faker.string.uuid() };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([
    'not-base64-json',
    Buffer.from('["yesterday","x"]').toString('base64url'),
    Buffer.from('{"at":1}').toString('base64url'),
    '',
  ])('rejects %j', (value) => {
    expect(() => decodeCursor(value)).toThrow(InvalidCursorError);
  });
});
