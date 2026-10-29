import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { testConfig } from '@codebase-ai/server-testing';
import { AppModule } from '../app/app.module';
import { configureApp } from '../app/configure-app';
import { ApiTokenService } from '../app/modules/auth/services/api-token.service';
import { TEST_API_TOKEN } from './authorized-agent';

export interface TestAppOptions {
  /** Defaults to an empty environment, so no database is configured. */
  config?: AppConfig;
  controllers?: Type<unknown>[];
  overrides?: { provide: unknown; useValue: unknown }[];
}

/** Boots AppModule with the production global pipes, filters and guards; the token is TEST_API_TOKEN and no token file is touched. The caller closes the app. */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(APP_CONFIG)
    .useValue(options.config ?? testConfig())
    .overrideProvider(ApiTokenService)
    .useValue({ matches: (candidate: string) => candidate === TEST_API_TOKEN });
  for (const { provide, useValue } of options.overrides ?? []) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }
  const app = (await builder.compile()).createNestApplication();
  // Console output stays off; specs that assert on logs spy on Logger.prototype.
  app.useLogger(false);
  configureApp(app);
  await app.init();
  return app;
}
