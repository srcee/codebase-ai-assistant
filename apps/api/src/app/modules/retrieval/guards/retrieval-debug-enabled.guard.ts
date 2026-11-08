import {
  type CanActivate,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';

/** Global guards run first, so an unauthenticated caller still gets 401. */
@Injectable()
export class RetrievalDebugEnabledGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (!this.config.retrieval.debugEndpoint) throw new NotFoundException();
    return true;
  }
}
