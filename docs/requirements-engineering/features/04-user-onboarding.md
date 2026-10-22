## 4. User Onboarding

User Onboarding is an interactive mobile application tour. It teaches navigation
and common actions through highlighted controls, short explanations, and guided
taps across screens. It does not collect questionnaire answers or require users
to create real financial records.

### 4.1 Tour Entry and Controls

The first-use sequence is Account Registration →
[Savings and Debt Profile Questionnaire](03-savings-and-debt-profile-questionnaire.md)
→ this interactive tour. Email verification, authenticated access, and required
terms consent precede the questionnaire. Enter the tour after questionnaire
submission and its results screen, including when classification is unavailable.

- Offer Start tour and Skip for now after the user completes the questionnaire
  and continues from its results, after sign-in is complete
- Divide the tour into stages and display the current stage and progress
- Allow users to continue, return to an earlier step, or choose Continue later
- Save progress separately for each signed-in user and resume
  from the last unfinished step after returning to the application
- Treat skipping or pausing separately from completing the tour
- Make the tour available offline after the application is accessible locally

### 4.2 Guided Tour Flow

| Stage | Route and interactions | Guidance |
| --- | --- | --- |
| 1. Dashboard | Home → Dashboard → bottom navigation | Introduce financial summaries, recent transactions, forecasts, plan health, savings, debts, and unusual expenses. Explain Home, Money, Activity, and Plan. |
| 2. Money | Money → Accounts → Income → Billers & Remittances | Explain accounts and balances, income sources, and scheduled financial commitments. Highlight each section and its add action without requiring setup. |
| 3. Transactions | Activity → Transactions → Add Transaction → Edit → Delete | Explain transaction history and categories. Practice creating, reviewing, editing, and deleting a tour example, including explicit deletion confirmation. |
| 4. Planning | Plan → Savings Goals → Debts → Budget / Financial Planning | Explain goal targets and contributions, debt balances and repayments, and how these inform a Financial Plan. Explain classification and data prerequisites without opening a questionnaire or accepting a plan during the tour. |
| 5. Financial Reports | Header chart icon → Financial Reports | Explain period and category reports, personalized spending forecasts, unusual expenses, and forecast availability. |
| 6. Settings | Return to Home → profile icon → Settings | Introduce profile, preferences, privacy and consent, help, and the tutorial entry. Explain where settings live without requiring users to change them. |
| 7. Offline & Sync | Settings → sync status and details; highlight the sync indicator when visible | Explain supported offline actions, locally queued changes, synchronization, retry, and connectivity requirements. |
| 8. Replay and Finish | Settings → Help and About → Replay tutorial | Show the exact path for starting the tutorial again. Explain Resume tutorial for unfinished progress, then offer Finish and return to Dashboard. |

### 4.3 Navigation and Highlight Behavior

- Highlight one target and explain one action at a time
- Teach users how to reach each destination through visible navigation controls
- Advance interaction steps only after the expected tap or action succeeds
- Show guidance once the destination screen and highlighted control are ready
- Scroll the target into view and position guidance within the visible screen
- Restore the relevant screen when users return to an earlier step
- If a target is unavailable or loading fails, offer retry, skip, or continue later
  without leaving the user blocked behind an overlay
- Support readable text, screen-reader labels, and accessible navigation controls

### 4.4 Practice and Empty Screens

- Use a clearly labelled tour example for transaction practice without changing
  actual balances, reports, or pending financial changes
- Practice add → review → edit → delete using only the tour example
- Explain the consequences of deletion and require explicit confirmation even
  when deleting the example
- Clear the practice example when the tour ends or is paused, and provide it
  again when the practice step is resumed
- On empty accounts, income, billers, savings, or debt screens, explain the empty
  state and highlight the relevant add control without requiring real records
- Do not modify existing user records, submit real forms, change consent, accept
  Financial Plans, log out, or delete the user's account during the tour

### 4.5 Offline and Sync Guidance

- Explain which financial records can be viewed or managed locally and that
  supported offline changes wait on the device until they synchronize
- Explain Offline, Pending changes, Syncing, Up to date, and Sync failed statuses
- Show where to inspect pending or failed changes, the last successful sync,
  and how to manually synchronize or retry when connected
- Explain online-only actions and the availability of cached forecasts;
  refreshing forecasts requires connectivity
- Explain that unsynced changes must be synchronized before logout and that
  account deletion requires synchronization
- Teach sync states with explanations or labelled examples; do not require users
  to disconnect, generate failures, discard changes, or perform account actions

### 4.6 Scope Boundary

- User Onboarding does not collect, save, review, submit, or assess financial
  questionnaire responses, including seasonal spending answers
- [Savings and Debt Profile Questionnaire](03-savings-and-debt-profile-questionnaire.md)
  defines questionnaire inputs, drafts, and initial assessment results
- Completing the tour does not mean financial setup or classification is complete
- [User Settings](14-user-settings.md) provides Resume tutorial and Replay tutorial
  under Help and About
- Replay starts at the Dashboard stage with fresh tour progress and does not
  reset financial data, questionnaire answers, or preferences

### 4.7 Tour States

- Initial state: the user can start the tour or skip it for now
- Loading state: tour progress or the destination screen is loading
- Active state: the current target and guidance are displayed
- Waiting-for-action state: the expected navigation or practice action is pending
- Practice state: a labelled transaction example is available for guided actions
- Paused state: progress is saved for later continuation
- Skipped state: the user chose not to start the tour
- Resume state: unfinished progress is restored for continued guidance
- Replay state: the tour starts again from Dashboard
- Target-unavailable state: the target cannot be shown and recovery is available
- Complete state: the user finished the tour
- Error state: guidance or progress could not be loaded or saved

### 4.8 Tour Messages

- Initial state: `Welcome to Budgie. Take a guided tour to learn where things are and how to use them.`
- Practice state: `This is a tutorial example. It will not change your balances or financial records.`
- Paused state: `Continue whenever you are ready. Open Settings → Help and About → Resume tutorial.`
- Skipped state: `You can start the tour anytime from Settings → Help and About → Replay tutorial.`
- Resume state: `Continue your tutorial from where you left off.`
- Target unavailable: `This step is unavailable right now. Retry, skip this step, or continue later.`
- Progress save failure: `Your tutorial progress could not be saved. You can continue, but you may need to repeat this step later.`
- Replay instructions: `To take the tour again, tap your profile icon, open Settings → Help and About, and choose Replay tutorial.`
- Complete state: `You're ready! Replay this tutorial anytime from Settings → Help and About → Replay tutorial.`
- Error state: `The tutorial could not be loaded. Try again or continue using the app.`
