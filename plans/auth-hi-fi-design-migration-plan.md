# Auth Hi-Fi Design Migration Plan

## Goal

Migrate the current auth experience in `apps/app/components/AuthExperience.tsx` to match the design, color, and styling direction from `/home/charles/Downloads/Odin Mobile Hi-Fi (standalone).html` while preserving the existing auth behavior.

## Source Design Summary

The hi-fi auth design uses:

- Font: Manrope, with strong `700`/`800` headings and `400`/`500` body text.
- Primary brand: deep aquamarine `#013220` with bright aquamarine accents `#41EDA4` / `#12D583` / `#08B16A`.
- Surfaces: warm Porsche tones instead of pure white, especially `#FCF8F0`, `#F8EFDC`, and app canvas `#E7E5DF`.
- Text: near-black `#1B1C1A`, secondary `#414942`, muted `#6B7A6F`.
- Errors: Monza red scale, especially soft `#FFF0F2` and strong `#D9001F`.
- Field style: `52px` height, `14px` radius, `1.5px` border, warm canvas fill, aquamarine focus ring.
- Button style: `54px` height, `14px` radius, deep aquamarine background, subtle green shadow.
- Screen shape: phone-like card/sheet visual language with large rounded corners and warm surfaces.

## Current State

- Auth UI and auth behavior are colocated in one large file: `apps/app/components/AuthExperience.tsx`.
- Current palette is cooler and more generic: red CTA, teal brand, white cards, blue links, gray-blue accents.
- `tailwind.config.js` duplicates the current palette and should be updated with the new tokens.
- Icons use `@expo/vector-icons` / `MaterialCommunityIcons`; the hi-fi uses Phosphor, but adding a dependency is not needed for color and styling migration.

## Migration Strategy

Keep auth behavior stable. Change presentation in small, reviewable slices.

## Phase 1: Replace Design Tokens

Files:

- `apps/app/tailwind.config.js`
- `apps/app/components/AuthExperience.tsx`

Actions:

- Replace the current palette with hi-fi tokens:
- `aqua950: #013220`
- `aqua700: #0B8A55`
- `aqua600: #08B16A`
- `aqua500: #12D583`
- `aqua400: #41EDA4`
- `aqua50: #EFFEF7`
- `canvas: #E7E5DF`
- `card: #FCF8F0`
- `surface: #F8EFDC`
- `line: #EAEAE6`
- `ink: #1B1C1A`
- `ink2: #414942`
- `muted: #6B7A6F`
- `errorSoft: #FFF0F2`
- `error: #D9001F`
- `warning: #FB8E24`
- Keep backwards-compatible token names only if they reduce diff size during the migration, then remove unused old names after the screen is converted.

Acceptance:

- App still renders with NativeWind classes.
- No auth request or state logic changes.

## Phase 2: Restyle Shared Auth Primitives

Files:

- `apps/app/components/AuthExperience.tsx`

Actions:

- Update `FieldLabel` to use `text-[12.5px]`, `font-semibold`, and `ink2` color.
- Update `AuthField` to match the hi-fi inputs:
- height `52px`
- radius `14px`
- border `line` normally
- border `aqua500` when focused
- background `surface` normally
- background `card` when focused
- focus ring via shadow style, not extra wrapper logic
- Update `AuthButton`:
- height `54px`
- radius `14px`
- primary background `aqua950`
- primary shadow `rgba(1,50,32,.28)`
- secondary background `card`
- secondary border `line`
- Update `Notice`:
- error uses `errorSoft` + `error`
- success/default use aquamarine soft tones

Acceptance:

- Login, register, reset request, reset complete, Google disabled state, and authenticated state still work.
- Existing accessibility roles remain.

## Phase 3: Convert Screen Layout To Hi-Fi Auth Card

Files:

- `apps/app/components/AuthExperience.tsx`

Actions:

- Replace current desktop split marketing panel with a simpler auth-focused layout:
- full-screen warm canvas background
- centered auth card using `card` background
- large rounded card corners near `34px` on mobile and `28px` on wider screens
- green-tinted shadow matching the hi-fi
- header with logo, title, and subtitle only
- Remove `SwatchStrip`; it is demo/design-system scaffolding, not product UI.
- Keep `ScrollView` and safe-area behavior.
- Keep responsive width cap, but align closer to mobile-first auth card dimensions.

Acceptance:

- Mobile auth screen visually resembles the hi-fi Login Default frame.
- Web/wide layout remains usable without introducing a second design system.

## Phase 4: Align Auth Mode Content

Files:

- `apps/app/components/AuthExperience.tsx`

Actions:

- Use hi-fi copy where it fits current behavior:
- Login title: `Welcome back`
- Login subtitle: `Sign in to your Odin account`
- Register title: `Create account`
- Keep reset copy behavior-specific.
- Replace segmented login/register tabs with hi-fi footer links if product wants the exact screen model.
- Keep the current tab switcher if faster implementation is preferred; style it with warm surfaces and aquamarine active state.
- Keep Google button because current auth behavior supports it, but style it as hi-fi secondary.

Acceptance:

- Copy matches hi-fi where the current flow has matching states.
- No behavior regressions in mode switching.

## Phase 5: Privacy Consent Bottom Sheet Decision

The hi-fi register screen includes a privacy consent bottom sheet. Current code only shows static agreement text.

Recommendation:

- Do not add the bottom sheet in the initial visual migration.
- Keep current agreement text and restyle it.
- Add a separate ticket if legal/product requires explicit checkbox consent before registration.

Reason:

- The bottom sheet changes auth behavior, not just styling.
- It needs validation, disabled button behavior, copy approval, and probably backend/legal tracking.

## Phase 6: Font Handling

Actions:

- First pass: use system font with Manrope-like weights if Manrope is not already configured.
- If exact typography is required, add Manrope through the existing Expo font path in a separate small PR.

Recommendation:

- Do not add a font dependency in the styling PR unless visual QA rejects the system fallback.

## Phase 7: Verification

Run:

```bash
pnpm --filter app start
```

Manual checks:

- Login empty-email validation.
- Login wrong-password error state.
- Register password mismatch.
- Password reset request state.
- Reset complete state with and without recovery tokens.
- Google disabled helper state.
- Authenticated success card and logout.
- Mobile width around `375dp`.
- Narrow width around `320dp`.
- Wide web layout.

Optional if test setup is added later:

```bash
pnpm --filter app test
```

## Suggested PR Split

1. `style(frontend): add hi-fi auth design tokens`
2. `style(frontend): restyle auth fields and buttons`
3. `style(frontend): migrate auth screen layout`
4. `style(frontend): align auth notices and state copy`

## Explicit Non-Goals

- Do not change auth API routes.
- Do not change session, recovery-token, or Google auth behavior.
- Do not add Phosphor icons unless exact icon matching is required.
- Do not implement consent bottom-sheet behavior in the visual migration PR.
- Do not split the full auth state machine yet unless the visual diff becomes too risky to review.
