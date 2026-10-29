import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SanitizedExceptionFilter } from './filters/sanitized-exception.filter';
import { requestLoggingMiddleware } from './middleware/request-logging.middleware';

export function configureApp(app: INestApplication): void {
  app.use(requestLoggingMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SanitizedExceptionFilter());
}
