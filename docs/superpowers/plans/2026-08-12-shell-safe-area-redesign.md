# Shell Safe Area Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the deprecated React Native `SafeAreaView` usage and make safe-area handling consistent across the authentication and main shell flows.

**Architecture:** Add one `SafeAreaProvider` at the application root so every rendered flow receives measured inset values. Replace the remaining framework `SafeAreaView` import in `AuthExperience` with the already-used `react-native-safe-area-context` implementation; keep the existing shell layout and styling unchanged.

**Tech Stack:** Expo SDK 55, React Native 0.83, TypeScript, `react-native-safe-area-context`, pnpm.

## Global Constraints

- Frontend changes belong in `odin/apps/app/`.
- Install dependencies with pnpm only.
- Do not add a second safe-area abstraction or manually calculate device insets.
- Preserve existing layout, colors, keyboard behavior, and screen-specific safe-area edges unless verification shows a regression.
- Validate the complete app flow on iOS and Android where available, plus the existing app test/typecheck commands.

---

### Task 1: Make the safe-area dependency explicit

**Files:**
- Modify: `apps/app/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces the direct `react-native-safe-area-context` dependency consumed by `App.tsx`, `AuthExperience.tsx`, and `MobileShell.tsx`.

- [ ] **Step 1: Confirm the installed Expo-compatible package version**

Run from `odin/`:

```bash
pnpm --filter app why react-native-safe-area-context
```

Expected: the currently resolved package is reported as `5.6.2`, or pnpm reports the compatible version selected for Expo SDK 55.

- [ ] **Step 2: Add the dependency using Expo’s version resolver**

Run from `odin/`:

```bash
pnpm --filter app exec expo install react-native-safe-area-context
```

Expected: `apps/app/package.json` lists `react-native-safe-area-context` under `dependencies`, and `pnpm-lock.yaml` records the direct importer entry without unrelated dependency upgrades.

- [ ] **Step 3: Verify the dependency diff**

Run:

```bash
git diff -- apps/app/package.json pnpm-lock.yaml
```

Expected: only the direct safe-area dependency and the lockfile metadata needed for it are changed.

- [ ] **Step 4: Commit the dependency change**

```bash
git add apps/app/package.json pnpm-lock.yaml
git commit -m "build(deps): add safe area context directly"
```

### Task 2: Provide safe-area context at the app root

**Files:**
- Modify: `apps/app/App.tsx:1-72`

**Interfaces:**
- Consumes: `SafeAreaProvider` from `react-native-safe-area-context`.
- Produces: a provider wrapping `ToastProvider` and all authenticated/unauthenticated flows.

- [ ] **Step 1: Add the provider import**

Add this import alongside the existing app-level imports:

```tsx
import { SafeAreaProvider } from "react-native-safe-area-context";
```

- [ ] **Step 2: Wrap the existing app tree without changing branch logic**

Change the return structure from:

```tsx
return (
  <ToastProvider>
    {/* existing authenticated and unauthenticated branches */}
  </ToastProvider>
);
```

to:

```tsx
return (
  <SafeAreaProvider>
    <ToastProvider>
      {/* existing authenticated and unauthenticated branches */}
    </ToastProvider>
  </SafeAreaProvider>
);
```

Keep the existing `authenticated`, onboarding, auth, and `StatusBar` branches exactly as they are.

- [ ] **Step 3: Run the app typecheck/build validation**

Run from `odin/`:

```bash
pnpm --filter app exec tsc --noEmit
```

Expected: TypeScript completes with no errors.

- [ ] **Step 4: Commit the provider change**

```bash
git add apps/app/App.tsx
git commit -m "fix(app): provide safe area context at root"
```

### Task 3: Replace the deprecated authentication safe-area component

**Files:**
- Modify: `apps/app/components/AuthExperience.tsx:3-13,785-1129`

**Interfaces:**
- Consumes: `SafeAreaView` from `react-native-safe-area-context`, backed by the provider added in Task 2.
- Produces: the same authentication layout with the deprecation warning removed.

- [ ] **Step 1: Replace the import source**

Remove `SafeAreaView` from the `react-native` import:

```tsx
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
```

Add the context implementation:

```tsx
import { SafeAreaView } from "react-native-safe-area-context";
```

- [ ] **Step 2: Preserve the existing wrapper and layout styles**

Keep the existing JSX unchanged:

```tsx
<SafeAreaView className="flex-1">
  <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
    {/* existing authentication content */}
  </KeyboardAvoidingView>
</SafeAreaView>
```

Do not add manual padding or `useSafeAreaInsets`; the context component handles the inset padding natively.

- [ ] **Step 3: Confirm no deprecated imports remain**

Run from `odin/`:

```bash
rg 'SafeAreaView' apps/app --glob '*.{ts,tsx,js,jsx}'
```

Expected: both usages import `SafeAreaView` from `react-native-safe-area-context`, and no usage imports it from `react-native`.

- [ ] **Step 4: Run app tests and typecheck**

Run:

```bash
pnpm --filter app test -- --runInBand
pnpm --filter app exec tsc --noEmit
```

Expected: tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit the replacement**

```bash
git add apps/app/components/AuthExperience.tsx
git commit -m "fix(frontend): replace deprecated auth safe area view"
```

### Task 4: Verify the shell across device insets

**Files:**
- No new files.
- Inspect: `apps/app/App.tsx`
- Inspect: `apps/app/components/AuthExperience.tsx`
- Inspect: `apps/app/components/MobileShell.tsx`

- [ ] **Step 1: Start the Expo app**

Run from `odin/`:

```bash
pnpm --filter app start
```

- [ ] **Step 2: Verify the unauthenticated flow**

On iOS and Android, open the auth screen and confirm the logo, title, form, keyboard avoidance, and bottom content remain inside the safe area. Confirm the deprecation warning no longer appears.

- [ ] **Step 3: Verify the authenticated shell**

Sign in and confirm `MobileShell` still respects the top and bottom device insets, including a notched device or emulator. Confirm tab navigation, modals, and the bottom navigation remain visually unchanged.

- [ ] **Step 4: Verify the onboarding flow**

If onboarding is reachable, confirm it renders under the new root provider without a missing-context error or clipped content.

- [ ] **Step 5: Check the final diff and status**

Run:

```bash
git status --short
git diff main...HEAD --stat
```

Expected: only the app dependency/lockfile and safe-area wiring files are included; pre-existing unrelated working-tree changes remain untouched.

## Self-Review

- Coverage: the dependency, provider, deprecated import, tests, and device-level verification are covered.
- Placeholder scan: no implementation step depends on a future decision or unspecified file.
- Type consistency: all three consumers use the same `SafeAreaView` package, and the provider wraps every branch rendered by `App`.
