const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { configFile: path.resolve(__dirname, '../api/babel.config.cjs') }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  resetMocks: true,
};
