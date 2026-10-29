/// <reference types='vitest' />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

const tokenFile =
  process.env['API_TOKEN_FILE'] ??
  resolve(import.meta.dirname, '../../.local/api-token.secret');

// Read per request so the web server can start before the API creates the file; the token never reaches the bundle.
function readApiToken(): string | undefined {
  try {
    return readFileSync(tokenFile, 'utf8').trim() || undefined;
  } catch {
    return undefined;
  }
}

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:3000',
    rewrite: (path: string) => path.replace(/^\/api/, ''),
    configure: (proxy: {
      on(
        event: 'proxyReq',
        listener: (request: {
          setHeader(name: string, value: string): void;
        }) => void,
      ): void;
    }) => {
      proxy.on('proxyReq', (request) => {
        const token = readApiToken();
        if (token) request.setHeader('Authorization', `Bearer ${token}`);
      });
    },
  },
};

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  server: {
    port: 4200,
    host: 'localhost',
    proxy: apiProxy,
  },
  preview: {
    port: 4300,
    host: 'localhost',
    proxy: apiProxy,
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/web',
      provider: 'v8' as const,
      thresholds: { statements: 85, branches: 80, functions: 85, lines: 85 },
    },
  },
}));
