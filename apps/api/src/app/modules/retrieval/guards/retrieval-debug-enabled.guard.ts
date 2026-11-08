import {
  type CanActivate,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';

/** Hides the debug search route unless RETRIEVAL_DEBUG_ENDPOINT is true; the global guards still run first. */
@Injectable()
export class RetrievalDebugEnabledGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (!this.config.retrieval.debugEndpoint) throw new NotFoundException();
    return true;
  }
}
