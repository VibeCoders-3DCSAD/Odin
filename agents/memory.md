# Memory

## Regression Sections

### RN 0.83 Jest Testing (Yak Shave Recovered)

The jest config for `apps/app` was broken after React Native 0.83 deleted the
component exports from `react-native/jest/mock.js`. Old configs that mapped
`react-native` to that mock file neither render components nor reach a stable
state. The working combo is:

- jest config uses `preset: 'react-native'` so the real RN environment
  (`jest/react-native-env.js`) is used and `Platform.OS` resolves.
- `babel-preset-expo` (via `apps/app/babel.config.js`) statically transpiles
  ESM to CJS when babel-jest drives it, so RN internals like `RCTModalHostView`
  load without `--experimental-vm-modules`.
- `react-test-renderer` is pinned to `19.2.0` via `pnpm-workspace.yaml`
  `overrides` AND as a direct `apps/app` devDependency (the override alone does
  not downgrade the RNTL peer auto-install; the direct devDep hoists 19.2.0 to
  root `node_modules`).
- Dynamic `import()` is NOT transpiled by babel-preset-expo, so
  `financialFoundations.test.ts` (which uses `await import()` after
  `jest.resetModules()` to re-instantiate the lazy `dbPromise` singleton per
  test) requires `NODE_OPTIONS=--experimental-vm-modules` in the test script.

Regression warning: converting that test's dynamic imports to static imports
breaks DB isolation — the module-level `dbPromise` is cached on the first call,
so `mockInitDatabase.mockResolvedValue(db)` in later tests never runs and tests
silently use stale DB stubs (e.g. `NOT_FOUND` instead of `VALIDATION_ERROR`).
Do not "simplify" that dynamic import away.

Current config that works (run `pnpm run test` in `apps/app`):

```json
"test": "NODE_OPTIONS=--experimental-vm-modules jest --config jest.config.cjs"
```

`apps/app/jest.config.cjs`:

```js
module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^react-test-renderer/package\\.json$': '<rootDir>/../../node_modules/react/package.json',
  },
  resetMocks: false,
};
```

`pnpm-workspace.yaml` pin:

```yaml
overrides:
  react-test-renderer: 19.2.0
```

`apps/app/package.json` devDependencies include `"react-test-renderer": "19.2.0"`.