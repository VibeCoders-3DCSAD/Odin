# Investigation: Auth Create Account Touch State

## Status

Resolved

## Problem

On Android mobile dev builds, the auth screen appeared to ignore most taps after using the Create account control. Text inputs still accepted focus and typing, which made the issue look like a global mobile touch/responder problem.

## Impact

- Affected `apps/app/components/AuthExperience.tsx` on Android dev builds.
- Blocked the register flow from the apparent primary Create account control.
- Made unrelated controls appear broken after attempting to switch modes.

## Symptoms

- Web worked normally.
- Android dev build could focus email and password fields.
- Buttons and links initially appeared unclickable.
- `Forgot password?`, reset Sign in, Sign in, and Google worked during later probing.
- The top Create account tab logged touch and press events but the visible screen still appeared stuck on sign-in.

## Evidence

- `main` reproduced the same mobile symptom, so the issue was not caused only by the hi-fi redesign branch.
- Temporary logs showed React was receiving root touches:
  - `[DEBUG-auth-tap] touch start: auth root`
- Temporary logs showed the top Create account tab received press events:
  - `[DEBUG-auth-tap] press in: tab Create account`
  - `[DEBUG-auth-tap] set mode: register`
- Temporary render logs showed state committed:
  - `[DEBUG-auth-tap] render mode: register, email:`
- Other mode changes worked:
  - `Forgot password?` rendered `reset_password`
  - reset Sign in rendered `login`

## Root Cause

The auth UI had two login/register switching controls: a top segmented tab and a footer mode-switch link. The top Create account tab created a confusing duplicate state path where React committed `mode: register`, but the visible flow still appeared stuck and subsequent interaction debugging was misleading.

The confirmed product fix was to remove the redundant top segmented login/register tabs and keep the footer mode switch as the single login/register transition.

Uncertain: the exact native rendering/responder interaction that made the duplicated top tab path appear stuck was not isolated further after the product fix was confirmed.

## Options Considered

### Option 1: Keep Both Mode Switchers And Continue Instrumenting

Pros:
- Could isolate the exact native rendering quirk.

Cons:
- Keeps redundant UI.
- More debugging for a control that is not needed.
- Higher risk of preserving a confusing state path.

### Option 2: Remove The Top Segmented Tabs

Pros:
- Minimal product fix.
- Removes duplicate state transitions.
- Matches the hi-fi direction better by relying on footer auth-mode links.
- Confirmed by manual mobile testing.

Cons:
- Does not fully explain the lower-level native rendering oddity.

## Decision

Remove the top segmented login/register tabs from `AuthExperience.tsx`. Keep the footer login/register link as the single source of truth for switching between login and register modes.

## Implementation Plan

- Remove the top segmented Sign in/Create account tab block.
- Keep footer mode switch behavior.
- Remove temporary `[DEBUG-auth-tap]` logs after debugging is complete.
- Verify login, register, forgot password, Google, and password visibility controls on Android dev build.

## Verification

- Manual Android dev-build check confirmed the issue was fixed after removing the top segmented tabs.
- Typecheck command passed:
  - `npx tsc --noEmit --pretty`

## Follow-ups

- Remove all temporary `[DEBUG-auth-tap]` instrumentation before merging.
- If the native rendering oddity returns elsewhere, add a smaller isolated reproduction with one `Pressable`, one `TextInput`, and one mode state value.
