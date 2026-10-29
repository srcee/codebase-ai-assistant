import { ConsoleLogger } from '@nestjs/common';
import type { LogFormat, LogLevel } from '@codebase-ai/server-config';
import { currentRequestId } from '../utils/request-context';
import { logLevelsFrom } from '../utils/log-levels-from';

/** Console logger that tags each line with the id of the request being handled. */
export class AppLogger extends ConsoleLogger {
  constructor(settings: { level: LogLevel; format: LogFormat }) {
    super({
      logLevels: logLevelsFrom(settings.level),
      json: settings.format === 'json',
    });
  }

  protected override formatContext(context: string): string {
    const requestId = currentRequestId();
    const formatted = super.formatContext(context);
    return requestId ? `${formatted}[req:${requestId}] ` : formatted;
  }

  protected override getJsonLogObject(
    ...args: Parameters<ConsoleLogger['getJsonLogObject']>
  ): ReturnType<ConsoleLogger['getJsonLogObject']> & { requestId?: string } {
    const requestId = currentRequestId();
    const entry = super.getJsonLogObject(...args);
    return requestId ? { ...entry, requestId } : entry;
  }
}
