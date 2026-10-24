import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  // This library exists to hold the test-only imports.
  { files: ['**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
];
