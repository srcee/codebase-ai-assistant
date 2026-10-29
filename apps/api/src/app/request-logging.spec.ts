import {
  Body,
  Controller,
  Get,
  INestApplication,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import request from 'supertest';
import {
  assertNotLeaked,
  CANARY_SECRET,
  faker,
} from '@codebase-ai/shared-testing';
import { authorizedAgent } from '../testing/authorized-agent';
import { createTestApp } from '../testing/create-test-app';
import { currentRequestId } from './utils/request-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller('test')
class TestController {
  @Get('items/:id')
  item(@Param('id') id: string) {
    return { id };
  }

  @Get('who')
  whoGet() {
    return { requestId: currentRequestId() };
  }

  @Post('who')
  whoPost(@Body() _body: unknown) {
    return { requestId: currentRequestId() };
  }

  @Get('boom')
  boom(): never {
    throw new Error(CANARY_SECRET);
  }
}

describe('request logging', () => {
  let app: INestApplication;
  let lines: { level: string; message: string }[];

  const record = () => {
    lines = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          lines.push({ level, message: String(args[0]) });
        });
    }
  };
  const requestLines = () =>
    lines.filter((line) => / \d+ms$/.test(line.message));
  const agent = () => authorizedAgent(app);

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TestController] });
  });

  beforeEach(record);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('request id', () => {
    it('returns a fresh id on every response', async () => {
      const first = await agent().get('/health/live');
      const second = await agent().get('/health/live');
      expect(first.headers['x-request-id']).toMatch(UUID);
      expect(second.headers['x-request-id']).toMatch(UUID);
      expect(first.headers['x-request-id']).not.toBe(
        second.headers['x-request-id'],
      );
    });

    it('ignores an id sent by the client', async () => {
      const sent = faker.string.uuid();
      const response = await agent()
        .get('/health/live')
        .set('X-Request-Id', sent);
      expect(response.headers['x-request-id']).not.toBe(sent);
    });

    it('is available to handlers, also after the body is parsed', async () => {
      const getResponse = await agent().get('/test/who').expect(200);
      expect(getResponse.body.requestId).toBe(
        getResponse.headers['x-request-id'],
      );

      const postResponse = await agent()
        .post('/test/who')
        .send({ note: faker.lorem.word() })
        .expect(201);
      expect(postResponse.body.requestId).toBe(
        postResponse.headers['x-request-id'],
      );
    });
  });

  describe('request line', () => {
    it('logs the route pattern, never ids, queries, or bodies', async () => {
      const id = faker.string.uuid();
      await agent().get(`/test/items/${id}?token=${CANARY_SECRET}`).expect(200);

      expect(requestLines()).toEqual([
        {
          level: 'log',
          message: expect.stringMatching(/^GET \/test\/items\/:id 200 \d+ms$/),
        },
      ]);
      assertNotLeaked(lines, id, CANARY_SECRET);
    });

    it('does not log a request body', async () => {
      await agent().post('/test/who').send({ note: CANARY_SECRET }).expect(201);
      assertNotLeaked(lines, CANARY_SECRET);
    });

    it('logs unknown paths as unmatched without echoing them', async () => {
      const path = `/${faker.string.alphanumeric(16)}`;
      await agent().get(path).expect(404);

      expect(requestLines()).toEqual([
        {
          level: 'warn',
          message: expect.stringMatching(/^GET <unmatched> 404 \d+ms$/),
        },
      ]);
      assertNotLeaked(lines, path);
    });

    it('logs a malformed body as a client error', async () => {
      await agent()
        .post('/test/who')
        .set('Content-Type', 'application/json')
        .send('{"broken":')
        .expect(400);
      expect(requestLines()[0]).toMatchObject({ level: 'warn' });
    });

    it('logs rejected requests', async () => {
      await request(app.getHttpServer()).get('/codebases').expect(401);
      await agent().get('/health/live').set('Host', 'evil.test').expect(403);

      expect(requestLines().map((line) => line.message)).toEqual([
        expect.stringMatching(/^GET \/codebases 401 \d+ms$/),
        expect.stringMatching(/^GET \/health\/live 403 \d+ms$/),
      ]);
      expect(requestLines().map((line) => line.level)).toEqual([
        'warn',
        'warn',
      ]);
    });

    it('logs server errors at error level without the error message', async () => {
      await agent().get('/test/boom').expect(500);

      expect(requestLines()).toEqual([
        {
          level: 'error',
          message: expect.stringMatching(/^GET \/test\/boom 500 \d+ms$/),
        },
      ]);
      expect(lines.map((line) => line.message)).toContainEqual(
        'GET /test/boom failed: Error',
      );
      assertNotLeaked(lines, CANARY_SECRET);
    });
  });
});
