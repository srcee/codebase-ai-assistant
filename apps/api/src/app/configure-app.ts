import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SanitizedExceptionFilter } from './filters/sanitized-exception.filter';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SanitizedExceptionFilter());
}
