import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_CONFIG, AppConfig, ConfigError } from '@codebase-ai/server-config';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { ApiTokenFileError } from './app/modules/auth/errors/api-token-file.error';
import { PrivacyPolicyError } from './app/modules/privacy/errors/privacy-policy.error';
import { AppLogger } from './app/services/app-logger.service';

async function bootstrap() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  // Buffered until the configured logger exists, so no startup line is lost or misformatted.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  const { api, logging } = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(new AppLogger(logging));
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(api.port, api.host);
  Logger.log(`API listening on http://${api.host}:${api.port}`);
}

bootstrap().catch((error: unknown) => {
  if (
    error instanceof ConfigError ||
    error instanceof PrivacyPolicyError ||
    error instanceof ApiTokenFileError
  ) {
    Logger.error(error.message);
  } else {
    Logger.error(
      `Startup failed: ${error instanceof Error ? error.name : 'Unknown'}`,
    );
  }
  process.exit(1);
});
