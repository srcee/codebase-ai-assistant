import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './libs/server/database/src/lib/schema/index.ts',
  out: './libs/server/database/migrations',
  dbCredentials: { url: process.env['DATABASE_URL'] ?? '' },
});
