## 16. Offline Sync and Recovery Module

### 16.1 Sync Visibility

- View synchronization status
- View pending changes
- View failed changes
- View discarded changes
- View the last successful synchronization
- View offline, syncing, and synchronized states

### 16.2 Sync Recovery

- Retry individual failed changes
- Retry failed changes in bulk
- Manually start synchronization
- View friendly recovery guidance
- View paginated failed-change history
- Discard failed changes with explicit confirmation
- Preserve local data during synchronization failures

### 16.3 Account Safety

- Prevent logout while unsynced changes remain
- Attempt synchronization before account deletion
- Keep local changes recoverable after failed synchronization
- Display network-required messaging for online-only actions

### 16.4 Sync States

- Initial state: synchronization is ready for use
- Offline state: the device has no network connection
- Pending state: local changes are waiting to synchronize
- Syncing state: local changes are being uploaded or remote changes downloaded
- Synchronized state: local and remote data are current
- Partially-synchronized state: some changes succeeded while others remain pending
- Failed state: one or more changes could not synchronize
- Retry-pending state: failed changes are queued for another attempt
- Retrying state: failed changes are being retried
- Discard-confirmation state: the user must confirm discarding failed local changes
- Discarded state: failed local changes were explicitly discarded
- Recovery state: the user is reviewing guidance for failed changes
- Logout-blocked state: logout is blocked while unsynced changes remain
- Deletion-sync state: synchronization is required before account deletion
- Network-required state: the requested action requires connectivity
- Error state: synchronization status or recovery data could not be loaded
- Success state: synchronization or recovery action completed

### 16.5 Offline Sync and Recovery Messages

#### Error Messages

- Failed state: `Some changes could not be synchronized. Review them and retry or discard them.`
- Logout-blocked state: `You have unsynced changes. Synchronize them before logging out.`
- Deletion-sync state: `Your changes must be synchronized before account deletion. Reconnect and try again.`
- Network-required state: `This action needs an internet connection. Reconnect and try again.`
- Error state: `Synchronization information could not be loaded. Refresh and try again.`

#### Notice Messages

- Initial state: `Synchronization is ready. Review your sync status or start a synchronization when you are online.`
- Offline state: `You are offline. Your local changes will sync when you reconnect.`
- Pending state: `Some changes are waiting to sync. Reconnect to send them.`
- Synchronized state: `Your data is synchronized. Continue using Odin with the latest saved changes.`
- Partially-synchronized state: `Some changes were synchronized and others are still waiting. Review the remaining changes.`
- Retry-pending state: `A failed change is waiting for another attempt. Reconnect or retry it when ready.`
- Discard-confirmation state: `Discarding this change removes it from the sync queue. Confirm only if you no longer need it.`
- Discarded state: `The change was discarded. Review your remaining changes and record it again if you still need it.`
- Recovery state: `Recovery guidance is available. Review the change details before choosing retry or discard.`

#### Progress and Success Messages

- Syncing state: `Synchronizing your changes. Please wait a moment.`
- Retrying state: `Retrying the failed changes. Please wait a moment.`
- Success state: `Your synchronization or recovery action is complete. Review the updated status.`
