import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';

/** In-process limit; the API is a single local process. */
@Injectable()
export class ChatConcurrencyService {
  private active = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Returns a release function, or undefined when the limit is reached. */
  tryAcquire(): (() => void) | undefined {
    if (this.active >= this.config.chat.maxConcurrent) return undefined;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }
}
