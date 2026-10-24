import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { DatabaseHealth } from '@codebase-ai/contracts';
import { DatabaseService } from '@codebase-ai/server-database';
import {
  assertNotLeaked,
  CANARY_SECRET,
  databaseHealthFactory,
  faker,
  healthResponseFactory,
} from '@codebase-ai/shared-testing';
import { createTestApp } from '../testing/create-test-app';
import { AppModule } from './app.module';

class EchoDto {
  @IsString()
  name!: string;
}

@Controller('test')
class TestController {
  @Post('echo')
  echo(@Body() body: EchoDto) {
    return body;
  }

  @Post('boom')
  boom(): never {
    throw new Error(CANARY_SECRET);
  }
}

describe('API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TestController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is degraded when no database is configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    expect(response.body).toEqual(
      healthResponseFactory.build({
        status: 'degraded',
        database: databaseHealthFactory.unconfigured().build(),
      }),
    );
  });

  it('GET /codebases returns 503 when no database is configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/codebases')
      .expect(503);
    expect(response.body).toEqual({
      statusCode: 503,
      message: 'DATABASE_URL is not configured',
    });
  });

  it('accepts a valid body', async () => {
    const body = { name: faker.person.firstName() };
    const response = await request(app.getHttpServer())
      .post('/test/echo')
      .send(body)
      .expect(201);
    expect(response.body).toEqual(body);
  });

  it('rejects unknown body fields', async () => {
    await request(app.getHttpServer())
      .post('/test/echo')
      .send({ name: faker.person.firstName(), extra: 1 })
      .expect(400);
  });

  it('rejects a malformed body', async () => {
    await request(app.getHttpServer())
      .post('/test/echo')
      .send({ name: faker.number.int() })
      .expect(400);
  });

  it('hides internal error details', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/boom')
      .expect(500);
    assertNotLeaked(response.body, CANARY_SECRET);
  });
});

describe('health with a database', () => {
  let app: INestApplication | undefined;

  const healthWith = async (database: DatabaseHealth) => {
    const started = await createTestApp({
      overrides: [
        {
          provide: DatabaseService,
          useValue: { checkHealth: async () => database },
        },
      ],
    });
    app = started;
    return () => request(started.getHttpServer()).get('/health');
  };

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns ok when the database and vector column are ready', async () => {
    const expected = healthResponseFactory.build();
    const getHealth = await healthWith(expected.database);
    await getHealth().expect(200).expect(expected);
  });

  it.each([
    [
      'the vector extension is missing',
      databaseHealthFactory.withoutVectorExtension(),
    ],
    ['the schema is not migrated', databaseHealthFactory.notMigrated()],
    [
      'the column dimension differs from config',
      databaseHealthFactory.params({
        embeddingDimensions: 768 + faker.number.int({ min: 1, max: 512 }),
      }),
    ],
    ['the database is down', databaseHealthFactory.down()],
  ])('returns 503 when %s', async (_name, factory) => {
    const getHealth = await healthWith(factory.build());
    const response = await getHealth().expect(503);
    expect(response.body.status).toBe('degraded');
  });
});

describe('startup configuration', () => {
  it('fails closed on a non-loopback host', async () => {
    const previous = process.env['API_HOST'];
    process.env['API_HOST'] = '0.0.0.0';
    try {
      await expect(
        Test.createTestingModule({ imports: [AppModule] }).compile(),
      ).rejects.toThrow(/API_HOST/);
    } finally {
      if (previous === undefined) delete process.env['API_HOST'];
      else process.env['API_HOST'] = previous;
    }
  });
});
