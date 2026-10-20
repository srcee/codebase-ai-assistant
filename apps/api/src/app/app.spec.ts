import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { APP_CONFIG, loadConfig } from '@codebase-ai/server-config';
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

  it('GET /health returns ok', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
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
