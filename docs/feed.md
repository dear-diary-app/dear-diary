# Private Home feed

Permanent photo posts for the two linked accounts, displayed below Home's date/status area. No videos. A post has 1 to 3 photos and an optional song, selected with the existing SongPicker without changing profile code. Photos are decoded, resized to at most 1600px, and JPEG-encoded locally (dropping EXIF); the service checks JPEG headers, dimensions and 5 MiB/file limits. An optional caption up to 1,000 characters is set when posting and displayed below photos/song. Existing posts have an empty caption. Text stays plain, with line breaks preserved.

## Privacy and lifecycle
- Existing sign-in and app-entry PIN gate wraps Home, post deep links and Chat.
- feed_posts records both owner and partner. RLS requires pair membership and the current friendship. Reactions and comments inherit this scope.
- Private feed bucket has no client Storage policies. feed-media checks a fresh auth token, friendship and the post before returning no-store JPEG bytes. No public/signed image links are generated. Blob URLs are revoked when views unmount.
- Owner can delete a post. New photo reads stop immediately. Metadata deletion queues physical files for minute-based cleanup with retry; orphan uploads older than 1 hour are queued too. Already displayed/downloaded pixels cannot be recalled.
- User-chosen post UUID makes a successful publish retry idempotent. Comments likewise have client UUIDs. Owner-only comment deletion. One emoji reaction per account per post, tap again to remove.
- Posts load in 15-row pages. Comments load in 50-row pages, newest page checked every 30 seconds while visible. No 24h expiry.

## DM replies
Reply in DM opens a private text composer. Only Send DM calls the existing chat sender. Its ordinary text body starts with a post marker/UUID, followed by optional quoted comment and the user's reply. Chat renders an in-app post link. It does not duplicate the post's media or grant access to a new audience. A deleted/inaccessible post opens an unavailable state. Chat's existing send failure/retry UI applies.

## Push
Existing Web Push subscriptions and VAPID service are reused. Feed has its own preference (on unless disabled), plus existing explicit per-device registration and browser permission. Only reactions/comments generate alerts, not post publishing. Alerts have generic body text, no photo/comment text and no reply action. Clicking opens the exact private post; an open diary editor is never navigated away. If the signed-in account differs, the running app ignores the navigation message.

feed_alerts is a private outbox. Event claim checks current friendship, post/source existence, preference, freshness and prior claim. At most one dispatch attempt per event, and a 30-second per-post/sender noise limit. Endpoint checks and expired-subscription cleanup match existing push services. Delivery remains best effort, not guaranteed; network errors do not roll back reactions/comments. Suppression for chat foreground remains unchanged.

## Validation
Stage 1: actual disposable users tested posting/retry, owner/partner media read, outsider denial, owner-only delete and read denial after deletion. All synthetic accounts/files removed. Mock UI at 320/390/820px tested 3-photo preview, explicit Post and lightbox.
Stage 2: rollback SQL tested pair/outsider visibility, idempotent comment UUID, own-comment delete and reaction toggle. Mock UI tested comments and DM composer; opening reply sends nothing, Send DM carries post and comment context.
Stage 3: rollback SQL tested outbox creation, single claim, replay prevention, opt-out and burst limit, with no committed dispatch. A sandbox service-worker test checked generic feed alert and exact-post click target. Existing foreground-chat-push regression tests passed. No real user content/PINs/device pushes used. Physical phone delivery is not verified.

Migrations: 0044 feed, 0045 social, 0046 push. Services: feed-media, send-feed-push. No theme-color/safe-area or profile-picker changes.

Caption follow-up: migration 0047 adds the bounded caption column. Both media service and database enforce the limit. Client uses a bounded textarea and retains text after failed posting.

Instagram-style layout update: square display crop only (original uploaded photo still opens intact), avatar/name/music header, swipe count/dots, outline social icons, hidden eight-emoji tray on long press or accessible chooser, actual-only reaction names, inline expandable caption, timestamp. Composer is header-action New post with large full-photo preview. Feed audio is off on mount, explicit speaker on/off at image bottom right, at most 30 seconds, stops on another audio/visibility/unmount. No profile picker or system colour changes.
