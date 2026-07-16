---
metadata:
  last_modified: "2026-07-16"
  version: "1.2.0"
  author: "Odin QA"
  status: "draft"
  description: "Gap analysis: app features without corresponding Maestro test cases"
---

# Untested Features — Gap Analysis

Cross-referenced against `TEST-CASES.md` (31 automated + 4 manual = 37 total) and the current app codebase.

---

## High Priority — Real functionality, no test coverage

| # | Feature | File | What users can do | Test Case |
|---|---------|------|-------------------|-----------|
| 1 | Categories / Taxonomy CRUD | `features/taxonomy/TaxonomyScreen.tsx`, `CategoryFormScreen.tsx`, `SubcategoryFormScreen.tsx` | Browse category groups, expand/collapse, create/edit/delete categories and subcategories, form validation, protected toggle, Filipino context toggle, delete confirmation dialogs | TAX-001 through TAX-008 (automated) |
| 2 | Password reset complete flow | `components/AuthExperience.tsx` (lines 868-957) | Set new password after clicking email link, password rules validation, show/hide toggle, token resolution, success switch to login | AUTH-021 (manual — requires email deep link) |
| 3 | Toast notification system | `components/Toast.tsx` | Appear, auto-dismiss (2.5s), manual dismiss, color variants (danger/success/warning), position (top/bottom) | Partially covered by SYNC-002, SET-002, SET-004; full coverage needs dedicated tests |
| 4 | Consent screen dismiss → logout | `features/governance/PrivacyConsentScreen.tsx` | Tap backdrop to dismiss consent, user returned to login, not entered without consent | CONSENT-004 (automated) |
| 5 | Google Sign-In (native) | `App.native.tsx` (lines 75-99, 169-200) | Google OAuth flow, Play Services check, fallback token extraction, cancellation handling | AUTH-022 (manual — requires OS-level Google account) |
| 6 | Session restore on launch | `App.native.tsx` (lines 117-167) | SecureStore read, Supabase session restore, loading spinner during restore, silent clear on failure | AUTH-020 (automated) |
| 7 | Email verification deep link | `components/AuthExperience.tsx` (lines 431-436) | Handle `auth/verify` URL, extract tokens, show "Email verified!" notice, switch to login mode | AUTH-023 (manual — requires email client) |
| 8 | Logout unsynced data protection | `components/MobileShell.tsx` (lines 177-236) | Check sync queue before logout, attempt sync if pending, show inline error if still unsynced | — |
| 9 | Account deletion success screen | `components/MobileShell.tsx` (lines 443-481) | "Deletion requested" overlay, 30-day grace period message, scheduled date card, "Back to login" button | SET-004 (automated — `optional: true` assertion) |
| 10 | Settings error + retry | `features/governance/PrivacySettingsScreen.tsx` (lines 371-405) | Error message with Retry button, re-fetches settings from API | SET-006 (manual — requires API failure simulation) |

---

## Medium Priority — Visible UI, edge cases

| # | Feature | File | What users can see/do |
|---|---------|------|----------------------|
| 11 | Registration email verification banner | `components/AuthExperience.tsx` (lines 1102-1109) | "Verification email sent to {email}" banner, auto-dismiss after 5s |
| 12 | Real-time field validation (register) | `components/AuthExperience.tsx` | Email/password/confirm field color tones (red/green), password rules with live indicators |
| 13 | Settings skeleton loading state | `features/governance/PrivacySettingsScreen.tsx` (lines 219-255) | Animated pulsing skeleton bars while settings load |
| 14 | Re-request export confirmation | `features/governance/UserProfileScreen.tsx` (lines 138-168) | Alert dialog: "This will cancel your current export request..." with Cancel/Request buttons |
| 15 | Consent screen success animation | `features/governance/PrivacyConsentScreen.tsx` (lines 100-121) | Green checkmark circle shown for 600ms after consent accepted |

---

## Low Priority — Placeholder / non-functional UI

| # | Feature | Status |
|---|---------|--------|
| 16 | Dashboard screen | "coming soon" placeholder |
| 17 | Transactions screen | "coming soon" placeholder |
| 18 | History screen | "coming soon" placeholder |
| 19 | Spending Forecast screen | "coming soon" placeholder |
| 20 | Anomaly Alerts screen | "coming soon" placeholder (hardcoded badge "3") |
| 21 | Budget Advice screen | "coming soon" placeholder |
| 22 | Savings & Goals screen | "coming soon" placeholder |
| 23 | Debt Manager screen | "coming soon" placeholder |
| 24 | Insurance screen | "coming soon" placeholder |
| 25 | Assistant screen | "coming soon" placeholder |
| 26 | Center FAB button (Add Transaction) | Navigates to "coming soon" placeholder |
| 27 | Search bar in taxonomy | `editable={false}`, non-functional |
| 28 | Bell icon in top bar | Non-interactive |
| 29 | Search icon in top bar | Non-interactive |
| 30 | Drawer profile section | Hardcoded name "Charles Togle", not from user data |
| 31 | Settings non-clickable rows | "Personal information", "Change password", "Alert frequency" — no `onPress` |
