# Published diary photo fix

Root cause verified against live pg_policies: entry_photos SELECT followed
published-entry visibility, but storage.objects photos_storage_select allowed
only the uploader folder. Partner image signing failed, and the frontend
silently omitted the photo URL. Text and song visibility were independent.

0049 adds a narrowly scoped partner SELECT path to private diary-photos:
linked friendship, exact entry_photos path, matching owner folder, published
parent, and the entry's 10 PM IST deadline already passed. Owner access is
unchanged. INSERT/UPDATE/DELETE and bucket privacy stay unchanged. No PIN,
route or publish logic changes. No image bytes or diary text read for diagnosis.

Live database regression used synthetic users, profiles, entries, photo
metadata and storage metadata inside forced-rollback transactions. Before:
owner allowed, partner denied even published attachments. After: linked
partner allowed only due published attachments, denied drafts, future
published entries and orphan uploads. Unrelated user denied all. Zero QA
profiles remain. Existing one-hour signed URLs and reader refresh stay as-is;
new signing now succeeds for permitted published partner photos.
