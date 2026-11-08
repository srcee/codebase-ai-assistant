export interface ShopConfig {
  port: number;
  databaseUrl: string;
  paymentBaseUrl: string;
  logLevel: 'debug' | 'info' | 'warn';
}

/** Builds the service settings from environment variables, using defaults where allowed. */
export function loadConfig(env: Record<string, string | undefined>): ShopConfig {
  return {
    port: Number(env['SHOP_PORT'] ?? 8080),
    databaseUrl: requireSetting(env, 'SHOP_DATABASE_URL'),
    paymentBaseUrl: requireSetting(env, 'SHOP_PAYMENT_URL'),
    logLevel: parseLogLevel(env['SHOP_LOG_LEVEL']),
  };
}

function requireSetting(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required setting ${name}`);
  return value;
}

function parseLogLevel(value: string | undefined): ShopConfig['logLevel'] {
  if (value === 'debug' || value === 'warn') return value;
  return 'info';
}
