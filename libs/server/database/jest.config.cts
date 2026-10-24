module.exports = {
  displayName: 'server-database',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/server/database',
  coverageThreshold: {
    global: { statements: 90, branches: 70, functions: 80, lines: 90 },
  },
};
