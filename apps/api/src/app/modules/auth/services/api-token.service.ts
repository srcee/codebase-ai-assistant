import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { ApiTokenFileError } from '../errors/api-token-file.error';

// 32 random bytes as base64url.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const digest = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

/** Holds the per-install API token; creates its file on first start. */
@Injectable()
export class ApiTokenService implements OnModuleInit {
  private tokenDigest?: Buffer;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  onModuleInit(): void {
    const path = this.config.api.tokenFile;
    const token = this.read(path) ?? this.create(path);
    if (!TOKEN_PATTERN.test(token)) throw new ApiTokenFileError('malformed');
    this.tokenDigest = digest(token);
  }

  matches(candidate: string): boolean {
    return (
      this.tokenDigest !== undefined &&
      timingSafeEqual(this.tokenDigest, digest(candidate))
    );
  }

  private read(path: string): string | undefined {
    let content: string;
    try {
      // Windows reports synthetic modes, so the permission check applies to POSIX only.
      if (process.platform !== 'win32' && (statSync(path).mode & 0o077) !== 0) {
        throw new ApiTokenFileError('permissions');
      }
      content = readFileSync(path, 'utf8');
    } catch (error) {
      if (error instanceof ApiTokenFileError) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw new ApiTokenFileError('unreadable');
    }
    return content.trim();
  }

  private create(path: string): string {
    const token = randomBytes(32).toString('base64url');
    try {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      // wx: never overwrite a file another process created first.
      writeFileSync(path, `${token}\n`, { flag: 'wx', mode: 0o600 });
      return token;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        const existing = this.read(path);
        if (existing !== undefined) return existing;
      }
      throw new ApiTokenFileError('unreadable');
    }
  }
}
