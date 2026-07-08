# VIB-94 Frontend Plan: Onboarding & Profile Assessment

## Overview

Implement the frontend for Phase 1c: Onboarding & Profile Assessment. The backend
(VIB-94) is already in `main` — this plan covers only the React Native / Expo
frontend surface in `odin/apps/app/`.

**Design reference:** `odin/docs/designs/design_v1.html` and
`odin/docs/designs/components_v1.html` (Penpot exports — view in browser).

---

## Branch Stacking Strategy

```text
main
 └─ feat/vib-94-frontend-onboarding-profile (current worktree branch)
     ├─ Slice 1: types + API client
     │   └─ Slice 2: onboarding wizard screen
     │       └─ Slice 3: onboarding submit + assessment flow
     │           └─ Slice 4: profile assignment screen
     │               └─ Slice 5: reassessment + integration polish
```

Each slice is a child branch of the previous. PRs target the parent branch.
Merge bottom-up: Slice 1 → Slice 2 → Slice 3 → Slice 4 → Slice 5 → `main`.

**Feedback loop per slice:**
1. Implement the slice
2. Self-audit against AGENTS.md standards
3. Address findings
4. Push and open PR targeting parent branch
5. Review PR diff, fix issues
6. Merge upward

---

## Slice 1: Types & API Client (foundation)

**Branch:** `feat/vib-94-frontend-slice-1-types-api`

### What it builds

All TypeScript types and API wrapper functions. No UI yet.

### Files created

```
odin/apps/app/features/onboarding/types.ts
odin/apps/app/features/onboarding/api.ts
odin/apps/app/features/profile/types.ts
odin/apps/app/features/profile/api.ts
odin/apps/app/features/onboarding/constants.ts
odin/apps/app/features/profile/constants.ts
```

### `features/onboarding/types.ts`

```typescript
// ---- Session ----
type OnboardingSession = {
  id: string;
  user_id: string;
  status: OnboardingStatus;
  started_at: string;
  submitted_at: string | null;
  current_step_key: string | null;
  raw_answers: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
};

type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "abandoned"
  | "superseded";

// ---- Response ----
type OnboardingResponse = {
  onboarding_session_id: string;
  question_key: string;
  answer: unknown;
  updated_at: string;
};

// ---- Submit result ----
type OnboardingSubmitResult = {
  session: { id: string; status: "submitted" };
  assessment: { id: string; proposed_profile_label: string };
  assignment: {
    id: string;
    profile_label: string;
    confirmation_required: boolean;
  };
};

// ---- API request bodies ----
type CreateSessionPayload = {
  raw_answers?: Record<string, unknown>;
  current_step_key?: string;
};

type UpdateSessionPayload = {
  raw_answers?: Record<string, unknown>;
  current_step_key?: string;
};

type SaveResponsePayload = {
  question_key: string;
  answer: unknown;
};

type SubmitSessionPayload = {
  confirm_data_use: true;
};
```

### `features/profile/types.ts`

```typescript
type FinancialProfileLabel =
  | "stable_flexible"
  | "stable_obligated"
  | "variable_flexible"
  | "variable_obligated";

type AssessmentMethod = "manual" | "questionnaire" | "cold_start" | "standard";

type ProfileAssignment = {
  id: string;
  user_id: string;
  assessment_id: string | null;
  profile_label: FinancialProfileLabel;
  is_active: boolean;
  confirmation_required: boolean;
  effective_from: string | null;
  confirmed_at: string | null;
  rejected_at: string | null;
  explanation: string | null;
  created_at: string;
};

type ExplanationDriver = {
  driver_key: string;
  driver_label: string;
  value_text: string | null;
  impact_label: string;
  explanation: string;
  sort_order: number;
};

type ProfileAssignmentCurrent = {
  assignment: ProfileAssignment | null;
  drivers: ExplanationDriver[];
};

// ---- API request bodies ----
type ConfirmAssignmentPayload = {
  assignment_id: string;
  confirmation: true;
};

type RejectAssignmentPayload = {
  assignment_id: string;
  override_reason: string;
};

type SelectProfilePayload = {
  profile_label: FinancialProfileLabel;
};

type ReassessPayload = {
  reason?: string;
  use_recent_transactions?: boolean;
  assessment_method?: AssessmentMethod;
};
```

### `features/onboarding/api.ts`

Wrapper functions following the existing `apiFetch<T>()` pattern from
`features/governance/api.ts`. Each function mirrors one backend endpoint:

| Function | Method | Path |
|---|---|---|
| `createOnboardingSession` | POST | `/odin/api/onboarding/sessions` |
| `updateOnboardingSession` | PATCH | `/odin/api/onboarding/sessions/:id` |
| `saveOnboardingResponse` | POST | `/odin/api/onboarding/sessions/:id/responses` |
| `submitOnboardingSession` | POST | `/odin/api/onboarding/sessions/:id/submit` |
| `getCurrentOnboardingSession` | GET | `/odin/api/onboarding/sessions/current` |

All functions accept `accessToken: string` as first argument and return
`{ response: Response; body: T }`.

### `features/profile/api.ts`

| Function | Method | Path |
|---|---|---|
| `getCurrentProfileAssignment` | GET | `/odin/api/profile/assignment/current` |
| `confirmProfileAssignment` | POST | `/odin/api/profile/assignment/confirm` |
| `rejectProfileAssignment` | POST | `/odin/api/profile/assignment/reject` |
| `selectProfileAssignment` | POST | `/odin/api/profile/assignment/select` |
| `requestProfileReassessment` | POST | `/odin/api/profile/reassess` |

### `features/onboarding/constants.ts`

```typescript
export const ONBOARDING_STEPS = [
  "income_type",
  "monthly_income",
  "monthly_obligations",
  "dependents",
  "review",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStepKey, string> = {
  income_type: "Income Type",
  monthly_income: "Monthly Income",
  monthly_obligations: "Monthly Obligations",
  dependents: "Dependents",
  review: "Review & Submit",
};
```

### `features/profile/constants.ts`

```typescript
export const PROFILE_LABEL_DISPLAY: Record<FinancialProfileLabel, string> = {
  stable_flexible: "Stable-Flexible",
  stable_obligated: "Stable-Obligated",
  variable_flexible: "Variable-Flexible",
  variable_obligated: "Variable-Obligated",
};

export const PROFILE_LABEL_DESCRIPTIONS: Record<FinancialProfileLabel, string> = {
  stable_flexible: "You have steady income with few fixed expenses, giving you high flexibility to save and invest.",
  stable_obligated: "You have steady income but significant fixed obligations that limit your disposable cash.",
  variable_flexible: "Your income varies but your obligations are low, giving you flexibility when cash flow is good.",
  variable_obligated: "Both your income and obligations are unpredictable — careful cash flow management is essential.",
};
```

### Audit checklist (Slice 1)

- [x] Types match backend response shapes from `odin/apps/api/src/routes/onboarding.ts` and `profile.ts`
- [x] API functions follow existing `apiFetch<T>()` pattern (10s timeout, Bearer token, `{ payload }` wrapper)
- [x] Constants kept separate from component code
- [x] No new dependencies added
- [x] Files placed under `features/` per existing pattern

---

## Slice 2: Onboarding Wizard Screen

**Branch:** `feat/vib-94-frontend-slice-2-onboarding-wizard`
**Depends on:** Slice 1

### What it builds

A multi-step onboarding form with step navigation, progress indicator, and
session persistence. The wizard captures the four question categories that map
to the `raw_answers` fields used by the `submit_onboarding_session` RPC:
`income_type`, `monthly_income`, `monthly_obligations`, `has_dependents`.

### Files created

```
odin/apps/app/features/onboarding/OnboardingScreen.tsx
odin/apps/app/features/onboarding/components/StepProgressBar.tsx
odin/apps/app/features/onboarding/components/IncomeTypeStep.tsx
odin/apps/app/features/onboarding/components/IncomeAmountStep.tsx
odin/apps/app/features/onboarding/components/ObligationsStep.tsx
odin/apps/app/features/onboarding/components/DependentsStep.tsx
odin/apps/app/features/onboarding/components/ReviewStep.tsx
odin/apps/app/features/onboarding/hooks/useOnboardingSession.ts
```

### Files modified

```
odin/apps/app/components/MobileShell.tsx  — add "onboarding" to Page type + routing
```

### Component details

#### `OnboardingScreen.tsx`
- Top-level screen orchestrating the wizard
- Props: `{ accessToken: string; onComplete: (result: OnboardingSubmitResult) => void }`
- State: current step index, session ID (from `useOnboardingSession` hook)
- Renders: `StepProgressBar` + current step component + Back/Next buttons
- On mount: calls `getCurrentOnboardingSession()` — if session exists, restores step; if session submitted, skips to profile assignment

#### `useOnboardingSession.ts`
- Custom hook managing session lifecycle
- `startSession()` → POST `/odin/api/onboarding/sessions`
- `updateAnswers(partial)` → PATCH `/odin/api/onboarding/sessions/:id`
- `saveResponse(question_key, answer)` → POST `/odin/api/onboarding/sessions/:id/responses`
- Returns: `{ sessionId, currentStep, answers, isCreating, isSaving, error }`

#### Step components
Each step is a presentational component:
- `IncomeTypeStep` — radio/card selection: salary, hourly, freelance, business, etc.
- `IncomeAmountStep` — numeric input for monthly income (PHP)
- `ObligationsStep` — numeric input for monthly obligations (PHP)
- `DependentsStep` — yes/no toggle or count selector
- `ReviewStep` — summary card showing all answers, tap to edit any

#### `StepProgressBar.tsx`
- Horizontal step indicator: 5 dots/segments with labels
- Active/completed/inactive states using palette colors
- Current step highlighted, completed steps show checkmark

### MobileShell integration

```typescript
// Add to Page type:
type Page = /* existing */ | "onboarding";

// Add to pageMeta:
onboarding: { title: "Onboarding", subtitle: "Tell us about your finances" }

// In renderPage(), before the settings check:
if (currentPage === "onboarding") {
  return <OnboardingScreen accessToken={accessToken} onComplete={handleOnboardingComplete} />;
}

// Add handleOnboardingComplete:
function handleOnboardingComplete(result: OnboardingSubmitResult) {
  // Navigate to profile assignment — implemented in Slice 3
  setCurrentPage("profile-assignment");
}
```

### Design notes

- Match existing palette: `#013220` (brand green), `#fcf8f0` (shell), `#F1F0EB` (card), `#1B1C1A` (ink)
- Font: Manrope (already loaded)
- Step cards should have rounded corners (14px) and subtle border (`#EAEAE6`)
- Input fields: bottom-bordered style like existing auth inputs
- Progress bar: thin line with dot markers
- Back/Next buttons: brand green primary, card-color secondary for Back

### Audit checklist (Slice 2)

- [ ] No business logic in JSX — step components are pure presentation
- [ ] Session lifecycle managed in hook, not in component
- [ ] Loading/error states handled per-step (not shared across all steps)
- [ ] Auth hydration guard — don't render until accessToken is available
- [ ] No prop drilling past 2 levels
- [ ] Matches design_v1.html visual patterns
- [ ] Responsive layout (flexbox, no magic pixel offsets)

---

## Slice 3: Onboarding Submit & Assessment Flow

**Branch:** `feat/vib-94-frontend-slice-3-submit-assessment`
**Depends on:** Slice 2

### What it builds

Submit button on the Review step with data-use confirmation checkbox,
loading/processing state, and navigation to the profile assignment screen.

### Files created

```
odin/apps/app/features/onboarding/components/SubmitConfirmationModal.tsx
odin/apps/app/features/onboarding/components/SubmittingOverlay.tsx
```

### Files modified

```
odin/apps/app/features/onboarding/components/ReviewStep.tsx  — add submit button + confirmation
odin/apps/app/features/onboarding/OnboardingScreen.tsx       — wire submit flow
odin/apps/app/components/MobileShell.tsx                      — add "profile-assignment" page
```

### Component details

#### `SubmitConfirmationModal.tsx`
- Shown when user taps "Submit" on ReviewStep
- Displays: data-use disclosure text, "I understand and agree" checkbox
- Submit button disabled until checkbox is checked
- Cancel button dismisses modal

#### `SubmittingOverlay.tsx`
- Full-screen overlay shown during submission (RPC may take a moment)
- Animated spinner + "Analyzing your profile..." message
- Handles: success → calls `onComplete(result)`, failure → shows error with retry

### Flow

```
ReviewStep "Submit" tap
  → SubmitConfirmationModal opens
    → User checks confirmation, taps "Confirm & Submit"
      → POST /odin/api/onboarding/sessions/:id/submit
        → SubmittingOverlay shown
          → Success → onComplete(submitResult)
          → Error → error state with retry button
```

### MobileShell changes

```typescript
// Add to Page type:
"profile-assignment"

// Store profile assignment data passed from submit:
const [profileAssignmentData, setProfileAssignmentData] = useState<OnboardingSubmitResult | null>(null);

// Onboarding complete handler:
function handleOnboardingComplete(result: OnboardingSubmitResult) {
  setProfileAssignmentData(result);
  setCurrentPage("profile-assignment");
}

// In renderPage():
if (currentPage === "profile-assignment") {
  return (
    <ProfileAssignmentScreen
      accessToken={accessToken}
      submitResult={profileAssignmentData}
      onConfirmed={() => setCurrentPage("dashboard")}
      onRejected={() => setCurrentPage("onboarding")}
    />
  );
}
```

### Audit checklist (Slice 3)

- [ ] Confirmation gate is mandatory (backend requires `confirm_data_use: true`)
- [ ] Submit button disabled while submitting (prevent double-tap)
- [ ] Error state shows actual backend error message
- [ ] Retry reuses same session (doesn't create a new one)
- [ ] SubmittingOverlay prevents back-navigation / accidental dismissal

---

## Slice 4: Profile Assignment Screen

**Branch:** `feat/vib-94-frontend-slice-4-profile-assignment`
**Depends on:** Slice 3

### What it builds

Profile assignment review screen showing the suggested financial profile with
driving factors, plus confirm/reject/manual-select flows.

### Files created

```
odin/apps/app/features/profile/ProfileAssignmentScreen.tsx
odin/apps/app/features/profile/components/ProfileCard.tsx
odin/apps/app/features/profile/components/DriverFactorList.tsx
odin/apps/app/features/profile/components/ConfirmActionSheet.tsx
odin/apps/app/features/profile/components/RejectReasonSheet.tsx
odin/apps/app/features/profile/components/ManualSelectSheet.tsx
odin/apps/app/features/profile/hooks/useProfileAssignment.ts
```

### Files modified

```
odin/apps/app/components/MobileShell.tsx  — profile assignment routing
```

### Component details

#### `ProfileAssignmentScreen.tsx`
- Props: `{ accessToken: string; submitResult?: OnboardingSubmitResult; onConfirmed: () => void; onRejected: () => void }`
- State: current assignment + drivers (fetched from API)
- Renders: `ProfileCard` + `DriverFactorList` + action buttons
- On mount: fetches `GET /odin/api/profile/assignment/current`
- Three action buttons:
  1. "Confirm Profile" → opens `ConfirmActionSheet`
  2. "Choose Different" → opens `ManualSelectSheet`
  3. "Reject" → opens `RejectReasonSheet`

#### `ProfileCard.tsx`
- Large card displaying profile_label (human-readable), description, and status
- Uses `PROFILE_LABEL_DISPLAY` and `PROFILE_LABEL_DESCRIPTIONS` from constants
- Visual: brand green background for suggested, card background for confirmed
- If confirmed: checkmark badge + "Active since {date}"

#### `DriverFactorList.tsx`
- Lists the `ExplanationDriver[]` from the GET assignment response
- Each driver shows: driver_label, value_text, impact_label chip, explanation
- Visual: compact cards with color-coded impact labels (positive = green, negative = amber, neutral = mut)

#### `ConfirmActionSheet.tsx`
- Bottom sheet (like Consent screen pattern)
- Displays: "Confirm {profile_label} as your financial profile?"
- Confirm button calls `POST /odin/api/profile/assignment/confirm`
- Shows loading state on confirm button
- On success: calls `onConfirmed()`

#### `RejectReasonSheet.tsx`
- Bottom sheet with text input for override_reason
- "Submit" button calls `POST /odin/api/profile/assignment/reject`
- Validation: reason must be non-empty
- On success: calls `onRejected()` (returns to onboarding)

#### `ManualSelectSheet.tsx`
- Bottom sheet listing all 4 profile labels as cards
- Each card shows display name + short description
- Tap a profile → calls `POST /odin/api/profile/assignment/select`
- On success: refreshes assignment display

#### `useProfileAssignment.ts`
- `fetchAssignment()` → GET `/odin/api/profile/assignment/current`
- `confirmAssignment(id)` → POST `/odin/api/profile/assignment/confirm`
- `rejectAssignment(id, reason)` → POST `/odin/api/profile/assignment/reject`
- `selectProfile(label)` → POST `/odin/api/profile/assignment/select`
- Returns: `{ assignment, drivers, isLoading, confirm, reject, select, error }`

### Audit checklist (Slice 4)

- [ ] Three distinct bottom sheets (confirm, reject, manual) — each isolated
- [ ] Confirm/reject buttons show per-action loading (not shared state)
- [ ] Reject reason input validated (non-empty, trims whitespace)
- [ ] Manual select validates label against whitelist
- [ ] Profile label display uses constants, no hardcoded strings in JSX
- [ ] Error handling for each mutation (show error, allow retry)
- [ ] Assignment can be null (no current assignment) — handle gracefully
- [ ] Drives can be empty array — don't show empty DriverFactorList

---

## Slice 5: Reassessment & Integration Polish

**Branch:** `feat/vib-94-frontend-slice-5-reassess-integration`
**Depends on:** Slice 4

### What it builds

Reassessment trigger, onboarding completion state in the auth flow, dynamic
drawer profile data, and edge-case handling.

### Files created

```
odin/apps/app/features/profile/components/ReassessSheet.tsx
odin/apps/app/features/profile/components/ProfileStatusBadge.tsx
odin/apps/app/hooks/useOnboardingStatus.ts
odin/apps/app/hooks/useProfileInfo.ts
```

### Files modified

```
odin/apps/app/components/MobileShell.tsx          — dynamic drawer profile, onboarding gate
odin/apps/app/components/AuthExperience.tsx        — pass onboardingStatus to shell
odin/apps/app/features/profile/ProfileAssignmentScreen.tsx  — add reassess button
odin/apps/app/App.tsx                              — onboarding gate before shell
odin/apps/app/App.native.tsx                       — onboarding gate before shell
```

### Component details

#### `ReassessSheet.tsx`
- Bottom sheet triggered from ProfileAssignmentScreen
- "Request Reassessment" button
- Optional: reason text input, recent transactions toggle
- Calls `POST /odin/api/profile/reassess`
- On success: shows confirmation, navigates back to onboarding

#### `ProfileStatusBadge.tsx`
- Small badge component: "Active", "Pending Confirmation", "Rejected", "Assessing..."
- Color-coded (green, amber, mut, blue respectively)

#### `useOnboardingStatus.ts`
- Reads `onboardingStatus` from auth state
- Fetches `GET /odin/api/onboarding/sessions/current` for full session data
- Returns: `{ status, session, isLoading, needsOnboarding, hasActiveAssignment }`

#### `useProfileInfo.ts`
- Fetches profile assignment + user display name
- Returns: `{ displayName, profileLabel, isLoading }`
- Used by MobileShell drawer footer to replace hardcoded values

### MobileShell changes

```typescript
// Dynamic drawer footer:
// Instead of hardcoded "Charles Togle" and "Stable-Obligated":
const { displayName, profileLabel } = useProfileInfo(accessToken);
// Render: displayName ?? "Loading..." and PROFILE_LABEL_DISPLAY[profileLabel]

// Onboarding gate:
const { needsOnboarding } = useOnboardingStatus(accessToken, authState.onboardingStatus);
// If needsOnboarding && currentPage === "dashboard" → redirect to "onboarding"

// Reassess from settings:
// Add "Reassess Financial Profile" option in settings or profile assignment screen
```

### Auth flow integration

In `App.tsx` / `App.native.tsx`:
- After authentication + consent, check `onboardingStatus`
- If `onboardingStatus` is `"in_progress"` or `"not_started"` → start onboarding flow
- If `onboardingStatus` is `"submitted"` → go to profile assignment
- Only show dashboard when onboarding is fully complete (profile confirmed)

```typescript
// Pseudocode:
if (onboardingStatus === "not_started" || onboardingStatus === "in_progress") {
  initialPage = "onboarding";
} else if (assignmentExists && !assignmentConfirmed) {
  initialPage = "profile-assignment";
} else {
  initialPage = "dashboard";
}
```

### Audit checklist (Slice 5)

- [ ] Dynamic drawer profile — no hardcoded values remain
- [ ] Onboarding gate prevents accessing dashboard before completion
- [ ] Auth hydration guard — resolve onboardingStatus before rendering
- [ ] Reassessment doesn't lose previous session data
- [ ] Edge case: no internet → handle fetch failures gracefully
- [ ] Edge case: session expired during onboarding → redirect to auth
- [ ] Edge case: multiple tabs/devices → session superseded detection
- [ ] Pass `accessToken` explicitly (never from global/auth context)
- [ ] No PII in client-side storage keys

---

## File Tree Summary

```
odin/apps/app/
├─ features/
│  ├─ onboarding/
│  │  ├─ OnboardingScreen.tsx
│  │  ├─ api.ts
│  │  ├─ constants.ts
│  │  ├─ types.ts
│  │  ├─ hooks/
│  │  │  └─ useOnboardingSession.ts
│  │  └─ components/
│  │     ├─ StepProgressBar.tsx
│  │     ├─ IncomeTypeStep.tsx
│  │     ├─ IncomeAmountStep.tsx
│  │     ├─ ObligationsStep.tsx
│  │     ├─ DependentsStep.tsx
│  │     ├─ ReviewStep.tsx
│  │     ├─ SubmitConfirmationModal.tsx
│  │     └─ SubmittingOverlay.tsx
│  └─ profile/
│     ├─ ProfileAssignmentScreen.tsx
│     ├─ api.ts
│     ├─ constants.ts
│     ├─ types.ts
│     ├─ hooks/
│     │  └─ useProfileAssignment.ts
│     └─ components/
│        ├─ ProfileCard.tsx
│        ├─ DriverFactorList.tsx
│        ├─ ConfirmActionSheet.tsx
│        ├─ RejectReasonSheet.tsx
│        ├─ ManualSelectSheet.tsx
│        ├─ ReassessSheet.tsx
│        └─ ProfileStatusBadge.tsx
├─ hooks/
│  ├─ useOnboardingStatus.ts
│  └─ useProfileInfo.ts
└─ components/
   └─ MobileShell.tsx  (modified — routing + dynamic drawer)
```

---

## API Contract Reference

All endpoints are mounted at `/odin/api` with `requireAuth` middleware.
Request body format: `{ payload: { ... } }`.
Response format: `{ payload: { ... } }` or `{ error: string; message: string }`.

### Onboarding Endpoints

| Method | Path | Request Body | Response Payload |
|---|---|---|---|
| POST | `/onboarding/sessions` | `{ raw_answers?, current_step_key? }` | `{ session: { id, user_id, status, started_at, ... } }` |
| PATCH | `/onboarding/sessions/:id` | `{ raw_answers?, current_step_key? }` | `{ session: { ... } }` (updated) |
| POST | `/onboarding/sessions/:id/responses` | `{ question_key, answer }` | `{ response: { onboarding_session_id, question_key, answer, updated_at } }` |
| POST | `/onboarding/sessions/:id/submit` | `{ confirm_data_use: true }` | `{ session, assessment, assignment }` |
| GET | `/onboarding/sessions/current` | — | `{ session: {...} \| null }` |

### Profile Endpoints

| Method | Path | Request Body | Response Payload |
|---|---|---|---|
| GET | `/profile/assignment/current` | — | `{ assignment: {...} \| null, drivers: [...] }` |
| POST | `/profile/assignment/confirm` | `{ assignment_id, confirmation: true }` | `{ success: true }` |
| POST | `/profile/assignment/reject` | `{ assignment_id, override_reason }` | `{ success: true }` |
| POST | `/profile/assignment/select` | `{ profile_label }` | `{ success: true }` |
| POST | `/profile/reassess` | `{ reason?, use_recent_transactions?, assessment_method? }` | `{ success, assessment_id, status, assessment_method }` |

### Profile Labels (whitelist)

| Value | Display |
|---|---|
| `stable_flexible` | Stable-Flexible |
| `stable_obligated` | Stable-Obligated |
| `variable_flexible` | Variable-Flexible |
| `variable_obligated` | Variable-Obligated |

### Assessment Methods (whitelist)

| Value |
|---|
| `manual` |
| `questionnaire` |
| `cold_start` |
| `standard` (default) |

---

## Patterns to Follow

1. **API calls:** Use the `apiFetch<T>()` pattern from `features/governance/api.ts`:
   - `AbortController` with 10s timeout
   - `Authorization: Bearer ${accessToken}`
   - `Content-Type: application/json`
   - Body wrapped as `{ payload: { ... } }`

2. **Error handling:** Check `!response.ok` or `body.error`. Show `body.message` to user.

3. **Loading states:** Per-action loading indicators (not shared across the screen).

4. **State management:** React `useState` / custom hooks (no zustand yet — keep it consistent).

5. **Styling:** NativeWind + inline palette for theme colors. No new CSS files.

6. **Routing:** Add pages to the `Page` union type in `MobileShell.tsx` (no router library).

7. **File naming:** PascalCase for components, camelCase for hooks/utils.

8. **No new dependencies.**

---

## Commit Mapping

```
Slice 1: feat(frontend): add onboarding and profile types and API client
Slice 2: feat(frontend): add multi-step onboarding wizard screen
Slice 3: feat(frontend): add onboarding submit and assessment flow
Slice 4: feat(frontend): add profile assignment review and action screens
Slice 5: feat(frontend): add reassessment flow and onboarding integration
```
