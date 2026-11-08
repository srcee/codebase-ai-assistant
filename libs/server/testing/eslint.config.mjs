import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  // The evaluation corpus is sample data for indexing, not code of this library.
  { ignores: ['eval/corpus/**'] },
  // This library exists to hold the test-only imports.
  { files: ['**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
];
