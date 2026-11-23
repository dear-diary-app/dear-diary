# Compact song credits

Checked 24 November 2026:
- https://performance-partners.apple.com/search-api requires promotional-purpose use, a nearby linked store badge, courtesy attribution for previews and streaming only (not downloading/caching/synchronizing).
- https://marketing.services.apple/itunes-identity-guidelines requires unmodified badge art, 30px minimum digital badge height and clear space; section 7.1 permits trademark credit once in legal notices or an additional screen.

SongPill keeps the linked 30px badge and “Preview provided courtesy of iTunes.” in one compact credit row. The “Up to 30 seconds” card sentence is removed; the actual playback cap remains. Trademark credit moved to Settings > Music credits, before Sign out. At narrow widths the courtesy line may wrap rather than being hidden. Title, artist, artwork, play/pause, preview cap, store-link validation and failure state are unchanged. SongPicker and compact variants otherwise unchanged. This is a layout/credit fix, not a claim of full legal clearance for all app uses of promotional media.

Synthetic UI checks: 320/390/820, paper/midnight, linked badge height and destination, courtesy only, no overflow, title/artist/play retained. Settings credit expands and Sign out stays last. Visual screenshots inspected. No real-account or private content used, no physical-phone playback test.

## Owner-requested removal

The owner subsequently explicitly requested permanent removal of the entire credit row. SongPill now omits it; Settings > Music credits keeps the courtesy line, badge linking to the official iTunes landing page, and trademark notice. The generic Settings link is not a per-track purchase link. This does not meet the Apple requirement for a proximate badge linked to the promoted content; the owner was informed of that caveat. Song search results retain their existing credits. No playback or data change.
