# Foreground chat notifications

Chat push alerts used to call showNotification unconditionally. The worker now checks window clients under this app's path, requiring both visible and focused, then asks those windows for the current signed-in account and a fresh document visibility/focus check. A matching foreground recipient suppresses only that chat system alert. The responder is attached at AuthProvider level, including the PIN screen, not just the chat route. No account ID is persisted in the worker.

Closed, hidden, unfocused, unrelated-path or other-account windows do not suppress. A 500ms timeout, window closure, unsupported response or failed lookup falls back to showing the notification. This avoids relying on server presence leases, which can remain active briefly after closing the app. Separate browser profiles/devices have separate workers and subscriptions: opening one does not mute the other.

No backend push subscription changes, no disabling notifications and no effect on realtime messages, unread counts or seen receipts. Diary reminders, friend-free notices and scheduled-message acknowledgements retain their existing behaviour. Existing notification-tray items are not removed. The new worker and page code both need to load, so reload/reopen after deployment.

Synthetic tests execute the generated worker with mocked clients and notification display. Cover foreground, no windows, hidden/unfocused, unrelated path/account, timeout, changed visibility, close race, multiple windows, non-chat and missing account. A browser test checks the page responder. No real push, account, PIN or subscription was used.

Physical Android and installed-PWA behaviour remains unverified. Visible/focused is the browser's report, not a guarantee about the OS. A switch to background during handling can race. Unsupported browsers or an old open page fail toward delivery rather than silently losing alerts. Background delivery still depends on notification permission, browser/OS push support and power restrictions. Force-stopping the browser is not guaranteed to deliver.

Browser guidance on the focused-window exception:
https://web.dev/articles/push-notifications-common-notification-patterns
