import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { DatabaseHealth } from '@codebase-ai/contracts';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
import { DatabaseService } from '@codebase-ai/server-database';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

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
    throw new Error('canary-secret-in-error-message');
  }
}

describe('API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(loadConfig({}))
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is degraded when no database is configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);
    expect(response.body).toEqual({
      status: 'degraded',
      database: {
        status: 'unconfigured',
        vectorExtension: false,
        embeddingDimensions: null,
      },
    });
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
    await request(app.getHttpServer())
      .post('/test/echo')
      .send({ name: 'x' })
      .expect(201);
  });

  it('rejects unknown body fields', async () => {
    await request(app.getHttpServer())
      .post('/test/echo')
      .send({ name: 'x', extra: 1 })
      .expect(400);
  });

  it('rejects a malformed body', async () => {
    await request(app.getHttpServer())
      .post('/test/echo')
      .send({ name: 42 })
      .expect(400);
  });

  it('hides internal error details', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/boom')
      .expect(500);
    expect(JSON.stringify(response.body)).not.toContain('canary-secret');
  });
});

describe('health with a database', () => {
  async function healthApp(database: DatabaseHealth) {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(loadConfig({}))
      .overrideProvider(DatabaseService)
      .useValue({ checkHealth: async () => database })
      .compile();
    const nestApp = moduleRef.createNestApplication();
    configureApp(nestApp);
    await nestApp.init();
    return nestApp;
  }

  it('returns ok when the database and vector column are ready', async () => {
    const nestApp = await healthApp({
      status: 'up',
      vectorExtension: true,
      embeddingDimensions: 768,
    });
    try {
      await request(nestApp.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({
          status: 'ok',
          database: {
            status: 'up',
            vectorExtension: true,
            embeddingDimensions: 768,
          },
        });
    } finally {
      await nestApp.close();
    }
  });

  it.each([
    [
      'the vector extension is missing',
      { status: 'up', vectorExtension: false, embeddingDimensions: 768 },
    ],
    [
      'the schema is not migrated',
      { status: 'up', vectorExtension: true, embeddingDimensions: null },
    ],
    [
      'the column dimension differs from config',
      { status: 'up', vectorExtension: true, embeddingDimensions: 1024 },
    ],
    [
      'the database is down',
      { status: 'down', vectorExtension: false, embeddingDimensions: null },
    ],
  ] as [string, DatabaseHealth][])(
    'returns 503 when %s',
    async (_name, database) => {
      const nestApp = await healthApp(database);
      try {
        const response = await request(nestApp.getHttpServer())
          .get('/health')
          .expect(503);
        expect(response.body.status).toBe('degraded');
      } finally {
        await nestApp.close();
      }
    },
  );
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
