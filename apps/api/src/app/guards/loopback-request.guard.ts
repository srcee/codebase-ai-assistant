import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(value: string, scheme: boolean): string | undefined {
  try {
    return new URL(scheme ? value : `http://${value}`).hostname;
  } catch {
    return undefined;
  }
}

/** Blocks DNS rebinding and cross-site requests; any port is accepted so the web dev server works. */
@Injectable()
export class LoopbackRequestGuard implements CanActivate {
  private readonly logger = new Logger('Http');

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const reason = this.rejectionReason(request);
    if (reason) {
      this.logger.warn(`Rejected ${request.method} request: ${reason}`);
      throw new ForbiddenException('Request rejected');
    }
    return true;
  }

  private rejectionReason(request: Request): string | undefined {
    const host = request.headers.host;
    if (!host || !LOOPBACK_HOSTNAMES.has(hostnameOf(host, false) ?? '')) {
      return 'foreign-host';
    }
    const origin = request.headers.origin;
    if (
      origin !== undefined &&
      !LOOPBACK_HOSTNAMES.has(hostnameOf(origin, true) ?? '')
    ) {
      return 'foreign-origin';
    }
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      return 'cross-site';
    }
    return undefined;
  }
}
