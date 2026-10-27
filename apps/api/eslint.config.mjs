import baseConfig from '../../eslint.config.mjs';

const egressMessage = 'Use EgressHttpClient from the privacy module.';

const sourceFiles = ['src/**/*.ts'];
const notSource = [
  'src/**/*.spec.ts',
  'src/**/testing/**',
  'src/app/modules/privacy/services/egress-http-client.service.ts',
];
const registry = 'src/app/modules/inference/constants/runtime-adapters.ts';
const adapterFolders = 'src/app/modules/inference/adapters/**/*.ts';

// Each block replaces the rule for its files, so every block repeats the shared parts.
const restrictedImports = (...extraPatterns) => [
  'error',
  {
    paths: ['http', 'https', 'node:http', 'node:https', 'undici', 'axios'].map(
      (name) => ({ name, message: egressMessage }),
    ),
    patterns: [
      {
        group: [
          'fishery',
          '@faker-js/*',
          '@codebase-ai/*-testing',
          '@codebase-ai/server-database/testing',
        ],
        message:
          'Test factories and helpers may only be imported from spec files and testing folders.',
      },
      ...extraPatterns,
    ],
  },
];

export default [
  ...baseConfig,
  {
    // Outbound HTTP must go through the privacy module's EgressHttpClient.
    files: sourceFiles,
    ignores: notSource,
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: egressMessage },
      ],
      'no-restricted-imports': restrictedImports({
        group: ['**/adapters/**'],
        message:
          'Inject EMBEDDING_PORT, CHAT_PORT or RUNTIME_HEALTH_PORT; runtime adapters are plugged in only through RUNTIME_ADAPTERS.',
      }),
    },
  },
  {
    files: [registry],
    rules: { 'no-restricted-imports': restrictedImports() },
  },
  {
    files: [adapterFolders],
    ignores: notSource,
    rules: {
      'no-restricted-imports': restrictedImports({
        // A path that goes up exactly one level lands in a sibling adapter folder.
        regex: '^\\.\\./(?!\\.\\./)',
        message: 'An adapter folder must not import another adapter folder.',
      }),
    },
  },
];
