import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DatabaseHealth } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import {
  createDatabase,
  type Database,
  type DatabaseHandle,
} from '../connection/create-database';
import { DatabaseNotConfiguredError } from './database-not-configured.error';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly handle?: DatabaseHandle;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // The pool connects lazily, so the API can start without a reachable database.
    this.handle = config.databaseUrl
      ? createDatabase(config.databaseUrl)
      : undefined;
  }

  get db(): Database {
    if (!this.handle) throw new DatabaseNotConfiguredError();
    return this.handle.db;
  }

  async checkHealth(): Promise<DatabaseHealth> {
    if (!this.handle) {
      return {
        status: 'unconfigured',
        vectorExtension: false,
        embeddingDimensions: null,
      };
    }
    try {
      const result = await this.handle.db.execute<{
        vector_extension: boolean;
        embedding_dimensions: number | null;
      }>(sql`
        select
          exists (select 1 from pg_extension where extname = 'vector') as vector_extension,
          (select a.atttypmod from pg_attribute a
            where a.attrelid = to_regclass('code_chunks')
              and a.attname = 'embedding' and not a.attisdropped) as embedding_dimensions
      `);
      const row = result.rows[0];
      return {
        status: 'up',
        vectorExtension: row.vector_extension,
        // pgvector stores the dimension directly in atttypmod.
        embeddingDimensions:
          row.embedding_dimensions !== null && row.embedding_dimensions > 0
            ? row.embedding_dimensions
            : null,
      };
    } catch (error) {
      // Error messages can embed connection details, so log only the name.
      this.logger.warn(
        `Database health check failed: ${error instanceof Error ? error.name : 'Unknown'}`,
      );
      return {
        status: 'down',
        vectorExtension: false,
        embeddingDimensions: null,
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.handle?.pool.end();
  }
}
