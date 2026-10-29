import { faker } from '@codebase-ai/shared-testing';
import { runInRequestContext } from '../utils/request-context';
import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let output: string[];

  beforeEach(() => {
    output = [];
    for (const stream of [process.stdout, process.stderr]) {
      jest.spyOn(stream, 'write').mockImplementation((chunk) => {
        output.push(String(chunk));
        return true;
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('text format', () => {
    const logger = () => new AppLogger({ level: 'log', format: 'text' });

    it('tags lines written during a request with its id', () => {
      const id = faker.string.uuid();
      runInRequestContext(id, () => logger().log('hello', 'Http'));
      expect(output.join('')).toContain(`[req:${id}]`);
    });

    it('adds nothing outside a request', () => {
      logger().log('hello', 'Http');
      expect(output.join('')).not.toContain('[req:');
    });
  });

  describe('json format', () => {
    const logger = () => new AppLogger({ level: 'log', format: 'json' });
    const lines = () =>
      output.map((line) => JSON.parse(line) as Record<string, unknown>);

    it('adds requestId during a request', () => {
      const id = faker.string.uuid();
      const message = faker.lorem.sentence();
      runInRequestContext(id, () => logger().log(message, 'Http'));
      expect(lines()).toEqual([
        expect.objectContaining({
          level: 'log',
          message,
          context: 'Http',
          requestId: id,
        }),
      ]);
    });

    it('omits requestId outside a request', () => {
      logger().log(faker.lorem.sentence(), 'Http');
      expect(lines()[0]).not.toHaveProperty('requestId');
    });
  });

  it('writes only the configured level and above', () => {
    const logger = new AppLogger({ level: 'warn', format: 'json' });
    logger.log(faker.lorem.sentence());
    logger.warn(faker.lorem.sentence());
    logger.error(faker.lorem.sentence());
    expect(
      output.map((line) => (JSON.parse(line) as { level: string }).level),
    ).toEqual(['warn', 'error']);
  });
});
