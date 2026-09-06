module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^react-test-renderer/package\\.json$': '<rootDir>/../../node_modules/react/package.json',
  },
  resetMocks: false,
};