import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_CONFIG, AppConfig, ConfigError } from '@codebase-ai/server-config';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { PrivacyPolicyError } from './app/modules/privacy/errors/privacy-policy.error';

async function bootstrap() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
    abortOnError: false,
  });
  configureApp(app);
  app.enableShutdownHooks();

  const { api } = app.get<AppConfig>(APP_CONFIG);
  if (api.allowNonLoopback) {
    Logger.warn(
      `API_ALLOW_NON_LOOPBACK is enabled; binding to ${api.host}. Protect this interface.`,
    );
  }
  await app.listen(api.port, api.host);
  Logger.log(`API listening on http://${api.host}:${api.port}`);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof ConfigError || error instanceof PrivacyPolicyError) {
    Logger.error(error.message);
  } else {
    Logger.error(
      `Startup failed: ${error instanceof Error ? error.name : 'Unknown'}`,
    );
  }
  process.exit(1);
});
