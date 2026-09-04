const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      configFile: path.resolve(__dirname, '../api/babel.config.cjs'),
      presets: ['@react-native/babel-preset'],
      plugins: ['@babel/plugin-transform-flow-strip-types'],
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^react-test-renderer/package\\.json$': '<rootDir>/../../node_modules/react/package.json',
    '^react-native$': '<rootDir>/../../node_modules/react-native/jest/mock.js',
  },
  resetMocks: false,
  transformIgnorePatterns: ['node_modules/(?!(@testing-library/react-native|react-native)/)'],
  globals: { __DEV__: false },
};
