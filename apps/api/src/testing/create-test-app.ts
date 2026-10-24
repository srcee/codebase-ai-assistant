import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { testConfig } from '@codebase-ai/server-testing';
import { AppModule } from '../app/app.module';
import { configureApp } from '../app/configure-app';

export interface TestAppOptions {
  /** Defaults to an empty environment, so no database is configured. */
  config?: AppConfig;
  controllers?: Type<unknown>[];
  overrides?: { provide: unknown; useValue: unknown }[];
}

/** Boots AppModule with the production global pipes and filters; the caller closes the app. */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(APP_CONFIG)
    .useValue(options.config ?? testConfig());
  for (const { provide, useValue } of options.overrides ?? []) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }
  const app = (await builder.compile()).createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
