import type { LogLevel as NestLogLevel } from '@nestjs/common';
import { LOG_LEVELS, type LogLevel } from '@codebase-ai/server-config';

/** Every level at least as severe as the configured one. */
export function logLevelsFrom(level: LogLevel): NestLogLevel[] {
  const enabled: NestLogLevel[] = LOG_LEVELS.slice(
    0,
    LOG_LEVELS.indexOf(level) + 1,
  );
  return ['fatal', ...enabled];
}
