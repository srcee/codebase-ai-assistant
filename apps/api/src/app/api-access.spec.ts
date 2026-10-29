import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { assertNotLeaked, faker } from '@codebase-ai/shared-testing';
import {
  authorizedAgent,
  bearer,
  TEST_API_TOKEN,
} from '../testing/authorized-agent';
import { createTestApp } from '../testing/create-test-app';

describe('API access control', () => {
  let app: INestApplication;
  const anonymous = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('API token', () => {
    it('serves liveness without a token', async () => {
      await anonymous()
        .get('/health/live')
        .expect(200)
        .expect({ status: 'ok' });
    });

    it('rejects a request without a token', async () => {
      const response = await anonymous().get('/codebases').expect(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
    });

    it.each([
      ['a wrong token', () => bearer(faker.string.alphanumeric(43))],
      ['a token without the scheme', () => TEST_API_TOKEN],
      ['another scheme', () => `Basic ${TEST_API_TOKEN}`],
      ['an empty token', () => 'Bearer '],
      ['an overlong token', () => bearer(faker.string.alphanumeric(600))],
    ])('rejects %s', async (_name, header) => {
      await anonymous()
        .get('/codebases')
        .set('Authorization', header())
        .expect(401);
    });

    it('accepts the token, with any scheme casing', async () => {
      await authorizedAgent(app).get('/codebases').expect(503);
      await anonymous()
        .get('/codebases')
        .set('Authorization', `bearer ${TEST_API_TOKEN}`)
        .expect(503);
    });

    it('protects the detailed health route', async () => {
      await anonymous().get('/health').expect(401);
    });

    it('never logs the presented or the real token', async () => {
      const messages: unknown[] = [];
      for (const method of ['log', 'warn', 'error'] as const) {
        jest
          .spyOn(Logger.prototype, method)
          .mockImplementation((...args: unknown[]) => void messages.push(args));
      }
      const wrong = faker.string.alphanumeric(43);
      const response = await anonymous()
        .get('/codebases')
        .set('Authorization', bearer(wrong))
        .expect(401);
      assertNotLeaked(
        [messages, response.body, response.headers],
        wrong,
        TEST_API_TOKEN,
      );
    });
  });

  describe('request origin', () => {
    const live = () => authorizedAgent(app).get('/health/live');

    it.each([
      'evil.test',
      'evil.test:3000',
      '127.0.0.1.evil.test',
      'localhost.evil.test:3000',
      '10.0.0.5:3000',
    ])('rejects the host %s, even on a public route', async (host) => {
      const response = await live().set('Host', host).expect(403);
      assertNotLeaked(response.body, host);
    });

    it.each(['localhost:4200', '127.0.0.1', '[::1]:3000'])(
      'accepts the host %s',
      async (host) => {
        await live().set('Host', host).expect(200);
      },
    );

    it.each(['https://evil.test', 'null', 'http://localhost.evil.test:4200'])(
      'rejects the origin %s',
      async (origin) => {
        await live().set('Origin', origin).expect(403);
      },
    );

    it.each(['http://localhost:4200', 'http://127.0.0.1:4200'])(
      'accepts the origin %s',
      async (origin) => {
        await live().set('Origin', origin).expect(200);
      },
    );

    it('rejects a cross-site fetch', async () => {
      await live().set('Sec-Fetch-Site', 'cross-site').expect(403);
    });

    it.each(['same-origin', 'same-site', 'none'])(
      'accepts Sec-Fetch-Site %s',
      async (site) => {
        await live().set('Sec-Fetch-Site', site).expect(200);
      },
    );

    it('checks the origin before the token', async () => {
      await anonymous().get('/codebases').set('Host', 'evil.test').expect(403);
    });

    it('logs a reason code without the offending value', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const host = `evil-${faker.string.alphanumeric(8)}.test`;
      await live().set('Host', host).expect(403);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('foreign-host'),
      );
      assertNotLeaked(warn.mock.calls, host);
    });
  });
});
