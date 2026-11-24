# Private song taste and scheduled diary song

Settings uses owner-only RLS for genres, languages, moods, artists and opt-in.
No account is silently enabled. Existing SongPicker is available for examples.
Preferences are sent only as song search terms to the same Apple catalogue as
manual search; no diary content or user identifiers go to the catalogue.

Cron: 16:20-16:29 UTC daily, equivalent to 21:50-21:59 Asia/Kolkata. The worker
and atomic apply RPC independently check the window. Missing-song draft only;
no page creation, overwrite, backfill or post-22:00 write. The function sets
only song, with the existing server write trigger still enforced. Manual song
changes/removal continue to work until 22:00. Taste is rechecked before apply.
A per-user/day advisory lock and result record make application idempotent.

Artist names are matched against catalogue artists; genre adds ranking.
Language/mood guide terms, not guaranteed metadata. Playable Apple preview
required. No match logs no_match and leaves empty; transient catalogue
failure records retry, attempted next minute before 22:00. Last result is
visible only to its owner. No song automatically plays or sends a push.

Text/sticker autosave now uses save_diary_draft, preserving the current server
song unless the user explicitly changes it. Draft buffers record songChanged.
The open editor checks its own song metadata every 30 seconds from 21:50 to
22:00. No diary text is fetched for recommendation. Old cached app versions
should be refreshed before relying on auto-song preservation.

QA: forced-rollback synthetic users, no real preferences/diary mutations;
owner taste allowed, linked friend denied, add/idempotency/no-match/deadline,
stale autosave preservation and explicit removal. Worker mocks: matching,
wrong artist, empty results, network retry, existing song, unauthorized caller.
UI 390/820/1440 save/opt-in/no overflow visually inspected. Typecheck/build.
