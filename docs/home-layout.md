# Feed-first Home

Home has a compact Dear Diary wordmark and create/activity/messages controls. The existing private story strip uses smaller photo circles, with replace/delete controls retained under the owner's active story. Two small diary links replace the large books. They go through the same diary PIN route and server access rules. The schedule is collapsed to a one-line phase/countdown; expanding it shows the full date, IST clock and schedule.

The feed follows immediately, with flat post headers and edge-to-edge photos on phones. Existing post behavior remains: full original photo proportions, swipe galleries, explicit song sound, double-tap heart, comments, reactions and DM reply. Feed controls remain sticky. Large non-touch desktop retains its sidebar and places the diary links/schedule alongside the feed. Bottom navigation and system safe-area/theme colors are untouched.

No database, permissions or real user data changes. Synthetic intercepted QA covers phone 320/390, touch tablet 820 and desktop 1440, light/dark themes, story replace chooser and delete cancel, top create chooser, schedule expansion, diary routing, messages, touch double-like idempotency, gallery swipe and contain fit. Existing idle-lock/draft/recorder/dialog regressions passed with the updated Home-ready selector.
