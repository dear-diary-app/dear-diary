# Listen before sending a song

The /music- picker no longer sends when a result is tapped. Selection opens a private preview step with the existing streamed sample player, Back and an explicit Send song button. No autoplay. Sending is locked against double clicks. A missing/failed preview does not prevent sharing the track link. Changing the query, going Back, hiding the app, another song/voice starting or unmounting stops playback. Fixed unmount cleanup to capture the media element before React clears the ref.

At the user's explicit choice after the licence caveat was explained, the new preview step has no badge or attribution line. Settings retains the Apple Music/iTunes credits. No audio is uploaded or deliberately cached/downloaded. The existing player caps playback at 30 seconds even when a provider clip is longer. Actual clip length/availability and playback depend on the provider, region, network and browser.

Source checked November 24, 2026:
https://performance-partners.apple.com/search-api
Apple describes previewUrl as a 30-second preview and requires streamed-only promotional use with nearby linked badge and attribution. This is a track-discovery preview, not a full-song player. Omitting the nearby badge and attribution does not meet those terms; Settings credits do not cure that gap.

Synthetic tests at 320/390/820 in paper/midnight: selection does not send, no autoplay, Play/Pause, enforced time cap, Back/unmount pauses, no badge/attribution in preview, no-preview state, explicit send lock and no horizontal overflow. Preview screenshots inspected and a clipped action-row layout corrected. Real provider audio and physical-phone playback remain unverified. No real messages/accounts/PINs/push used. Private reference deleted.
