const { join } = require('node:path');
const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  restoreMocks: true,
  clearMocks: true,
  coveragePathIgnorePatterns: ['/node_modules/', '/testing/'],
  // @faker-js/faker is ESM-only; Jest needs it compiled to CommonJS.
  transformIgnorePatterns: ['/node_modules/(?!@faker-js/)'],
  transform: {
    '^.+/node_modules/@faker-js/.+\\.js$': [
      'ts-jest',
      {
        tsconfig: join(__dirname, 'tsconfig.jest-vendor.json'),
        diagnostics: false,
      },
    ],
    ...nxPreset.transform,
  },
};
