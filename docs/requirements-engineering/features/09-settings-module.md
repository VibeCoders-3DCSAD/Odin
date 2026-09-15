## 9. Settings Module

### 9.1 Account and Profile

- View and edit the user profile
- View registered account information
- Change the password
- Manage connected authentication providers
- View email verification status
- View and manage the financial profile
- Resume incomplete onboarding

### 9.2 Settings Forms

- Display name
- Password change credentials
- Personalization preference
- Model-training consent
- Research-evaluation consent
- Notification preferences
- Data-retention preference, when available

### 9.3 Settings Form Placeholders

- Display name: `Enter display name`
- Current password: `Enter current password`
- New password: `Enter new password`
- Confirm new password: `Re-enter new password`
- Personalization preference: `Select personalization preference`
- Model-training consent: `Select model-training preference`
- Research-evaluation consent: `Select research-evaluation preference`
- Data-retention preference: `Select data-retention preference `
- Problem report: `Describe the problem`

### 9.4 Settings Selectors

- Personalization: On / Off
- Model-training consent: Granted / Not granted
- Research-evaluation consent: Granted / Not granted
- Data-retention preference, when available
- Savings notification preference
- Budget notification preference
- Debt notification preference
- Forecast notification preference
- Overspending notification preference
- In-app notification preference
- Push notification preference
- Connected authentication provider selector
- Export format selector, when multiple formats are supported

### 9.5 Settings Validation

- Require a valid display name when it is changed
- Require the current password for password changes
- Require a valid new password
- Require matching new-password fields
- Require an explicit choice for consent changes
- Prevent account deletion without explicit confirmation
- Preserve valid entries after validation failure
- Display validation feedback beside the affected field
- Clear field errors when corrected

### 9.6 Privacy and Consent

- View privacy settings
- Manage personalization consent
- Manage model-training consent
- Manage research-evaluation consent
- View thesis disclosure
- View data-use explanations
- View consent history and status
- View research eligibility separately from app access

### 9.7 Notification Preferences

- Manage savings notification preferences
- Manage budget notification preferences
- Manage debt notification preferences
- Manage forecast notification preferences
- Manage overspending notification preferences
- Manage in-app and push notification preferences

### 9.8 Data and Account Governance

- Export financial data
- View export status
- Manage data-retention preferences when available
- Request account deletion
- Review deletion consequences
- Cancel a pending deletion when supported
- Protect unsynced changes before account actions

### 9.9 Sync and Connectivity

- View synchronization status
- View pending and failed sync activity
- Retry failed synchronization
- Manually start synchronization
- Recover from exhausted sync failures
- Discard failed local changes with confirmation
- View offline and network-required states

### 9.10 Help and About

- View frequently asked questions
- View offline help content
- View sync guidance
- Report a problem
- View app version
- View thesis project information
- View the decision-support disclaimer
- View privacy information and applicable terms

### 9.11 Settings States

- Initial state: settings are ready for use
- Loading state: profile, preferences, consent, or sync data is loading
- Hydration state: authenticated account state is being resolved before protected settings render
- Empty-provider state: no connected authentication provider is available
- Unverified-email state: the account email requires verification
- Incomplete-profile state: required profile or financial-profile information is missing
- Unsaved-changes state: editable settings differ from saved values
- Saving state: a settings change is being saved
- Password-change state: password credentials are being updated
- Consent-review state: consent history and current decisions are displayed
- Export-preparing state: financial data export is being prepared
- Export-ready state: the export is available
- Export-failed state: the export could not be prepared
- Deletion-confirmation state: the user must review and confirm account deletion
- Deletion-pending state: account deletion has been requested and may be canceled
- Offline state: cached settings are available while network-required actions are unavailable
- Syncing state: local changes are being synchronized
- Sync-failed state: synchronization failed and can be retried
- Validation-failure state: settings input is invalid
- Error state: settings data could not be loaded or saved
- Success state: the requested settings action completed

### 9.12 Settings Messages

#### Validation Messages

- Invalid settings input: `Some settings need attention. Correct the marked fields and try again.`
- Settings validation failure: `Some settings could not be accepted. Correct the marked fields and try again.`

#### Error Messages

- No authentication provider: `No sign-in option is connected. Connect an authentication provider and try again.`
- Unverified email: `Your email is not verified yet. Verify your email before using protected settings.`
- Incomplete profile: `Your profile is missing required information. Complete the missing details and try again.`
- Export failed: `Your data export could not be prepared. Try the export again.`
- Sync failed: `Your changes could not be sent. Check your connection and try again.`
- Settings error: `Your settings could not be loaded or saved. Try again.`
- Empty provider: `No connected sign-in provider is available. Connect one before managing provider settings.`
- Loading failure: `Your settings are still loading. Wait a moment and try again.`
- Export failure: `Your data export failed to prepare. Try the export again.`

#### Notice Messages

- Initial state: `Your settings are ready. Review or update your preferences when you are ready.`
- Offline settings: `Some settings are available without internet access. Reconnect before using network-required actions.`
- Hydration: `Your account security is still being checked. Wait until settings finish loading.`
- Incomplete profile: `Your profile is incomplete. Add the missing information before continuing.`
- Unsaved changes: `You have unsaved settings changes. Save them or leave without saving.`
- Consent review: `Your consent choices are ready to review. Confirm each choice before saving.`
- Export preparing: `Your financial data export is being prepared. Wait for it to become available.`
- Export ready: `Your financial data export is ready. Download it before leaving this screen.`
- Deletion pending: `Your account deletion request is pending. Cancel the request before it is processed if you want to keep your account.`

#### Progress and Success Messages

- Settings loading: `Your settings are loading. Wait a moment for them to appear.`
- Password change: `Your password is being updated. Wait for confirmation before signing in again.`
- Settings syncing: `Your local settings changes are syncing. Keep the app open until syncing finishes.`
- Settings saving: `Your settings are being saved. Wait a moment for the update to finish.`
- Settings saved: `Your settings were saved. Continue using the app.`

#### Confirmation Messages

- Account deletion confirmation: `Deleting your account removes your account and associated financial data. Cancel to keep your account or confirm deletion to continue.`

#### Recovery Messages

- Sync recovery: `Some settings changes could not be synchronized. Retry them or review the failed changes before discarding anything.`
