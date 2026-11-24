# Foreground chat banner

System chat alerts are intentionally suppressed by the service worker when the same account is visible and focused. This applies throughout the app, not just in Chat. The missing foreground UI was the gap; the system-push path is unchanged.

ChatBanner is mounted inside ChatProvider and the app entry gate. New incoming, unread messages arriving after its initial history baseline show a top-fixed banner outside /chat and /chat/* while the app is visible and focused. History loads, edits, outgoing messages, already-seen messages, and messages older than the current session do not raise it. Realtime changes and polling reconciliation both feed the same message list and ID dedupe. It follows the New chat messages preference, without requiring Web Push permission. Text previews are intentionally visible within the unlocked app; blurred messages keep a generic label, and media uses short descriptive labels. Raw storage paths and image attribution metadata are not shown.

The banner dismisses after 10 seconds, by ×, when entering Chat, or on hiding the app. Tapping opens an inline reply, without navigation or marking the conversation read. The reply stays open until sent/cancelled. New arrivals while replying are queued as the latest next banner. Only explicit Send submits. The existing insert path handles the reply's message ID, reply_to and failure state. Failed attempts remain in Chat for Retry/Delete; the banner disables resending to avoid creating duplicates. No automatic send or external browser notification added.

QA: synthetic component data and mocked callbacks at 320/390/820px in paper and midnight. Verified actual computed fixed placement at the top, readable theme background, arrival/dismiss, tap-to-reply, Send-only, draft preservation, new-message queue, Chat/own/old/settings suppression, unsend, failure and no horizontal overflow. Existing service-worker foreground push test passes. No real accounts/messages/pushes touched. Physical-phone push delivery not tested. Theme-color and safe-area colours unchanged.

## Reply action and countdown

Collapsed banners have an explicit right-side Reply button; the message body
still opens the same inline reply. A three-pixel bottom bar shrinks over the
same ten-second deadline that dismisses the banner, using elapsed wall time.
It is hidden while reply/send is open, without timing out the draft. Queued
messages get a fresh ten seconds after a successful reply. No automatic sends,
notification-permission changes or system/safe-area colour changes.

Synthetic checks: 320/390/820/1440 widths, bar at half-time, exact expiry,
button/body tap, reply surviving 25 seconds, queue/reset, failure, settings,
old/own messages, hidden app, unsend and preserved diary draft.
