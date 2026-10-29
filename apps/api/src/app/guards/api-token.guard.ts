import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiTokenService } from '../modules/auth/services/api-token.service';

const BEARER = /^Bearer ([^\s]{1,512})$/i;

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: ApiTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const http = context.switchToHttp();
    const header = http.getRequest<Request>().headers.authorization;
    const candidate =
      header === undefined ? undefined : BEARER.exec(header)?.[1];
    if (candidate !== undefined && this.tokens.matches(candidate)) return true;

    http.getResponse<Response>().setHeader('WWW-Authenticate', 'Bearer');
    throw new UnauthorizedException('Missing or invalid API token');
  }
}
