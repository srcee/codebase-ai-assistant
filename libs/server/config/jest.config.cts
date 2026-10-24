module.exports = {
  displayName: 'server-config',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/server/config',
  coverageThreshold: {
    global: { statements: 95, branches: 75, functions: 95, lines: 95 },
  },
};
