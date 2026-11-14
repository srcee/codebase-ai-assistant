import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { ConversationsService } from './conversations.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deletes conversations not updated within CHAT_RETENTION_DAYS, at startup and daily. */
@Injectable()
export class ConversationRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ConversationRetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly conversations: ConversationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.chat.retentionDays === undefined) return;
    void this.purge();
    this.timer = setInterval(() => void this.purge(), DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async purge(now: Date = new Date()): Promise<number> {
    const days = this.config.chat.retentionDays;
    if (days === undefined) return 0;
    try {
      const deleted = await this.conversations.purgeUpdatedBefore(
        new Date(now.getTime() - days * DAY_MS),
      );
      this.logger.log(`retention purge deleted=${deleted}`);
      return deleted;
    } catch (error) {
      this.logger.warn(
        `retention purge failed: ${error instanceof Error ? error.name : 'Unknown'}`,
      );
      return 0;
    }
  }
}
