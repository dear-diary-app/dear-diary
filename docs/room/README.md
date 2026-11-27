# Room 2.13

Pair-only co-watching using the official YouTube IFrame player. Search is an unofficial TypeScript adapter derived from PyTubeSearch's MIT-licensed HTML extraction approach. Keep its license with distributions. Provider selection stays server-side. No Google key is configured or required for the web provider.

## Limits and privacy

- Explicit submit only. Duplicate taps suppressed. Client cache: 20 queries, 10 minutes. Backend worker cache: 256 hashed query keys, 10 minutes, same-query in-flight sharing. Cache is transient, not durable search history. Cold workers can miss it.
- 6 uncached searches/person/minute and emergency ceiling10,000/person/UTC day. Counters persist but query text does not. No daily count in UI. 30second worker cooldown after a failed upstream request. This does not prevent every YouTube block.
- Search queries go to YouTube. Playback contacts YouTube independently on both devices. No download/background playback/ad control.
- Room tables have RLS and no direct authenticated/anonymous grants. Security-definer RPC resolves the linked pair, serializes pair changes, verifies device session, and rejects stale control versions.
- One active session per person; joining on another device replaces the previous one.
- End deletes room/messages/members through cascade. Abandoned Room cleanup after24hours without activity, next10minute cron cycle. No promise to erase provider backups instantly.
- Heartbeat every1.5seconds; presence expires15seconds. Hidden/leave/offline/lock sends best-effort leave and pauses locally. If the request is lost, peer detection is delayed.
- Ordinary app locks remain. Only actual visible Room PLAYING state disables the2minute idle PIN; paused/buffering/left Room returns normal idle lock.

## Delivery and checks

Migrations0081/0082 precede room-search deployment, which performs authenticated user and linked-pair checks itself (gateway JWT verification is off for current token compatibility). Web release follows backend. APK2.13/code24 retains package/signer. No install-data reset.

Tests: isolated actual SQL via PGlite, actual search handler with mocked imports, source parser against one current public search HTML, synthetic browser flows at320/390/820/1440 and844landscape, clock-based idle-lock behavior, Android unit/lint/assembly. Mocked iframe is not real-video or real-device sync evidence.

Before relying on production use: verify real two-device playback controls, autoplay taps, seek/rejoin, ads, fullscreen/Back, rotation and lock/background on Joydeep phone and partner tablet. Basic separate test-player playback was user-confirmed on Joydeep phone only.

Current official API can be selected later with ROOM_SEARCH_PROVIDER=official plus YOUTUBE_DATA_API_KEY server secret. Setup/approval and checking the actual project quota still required. Never put the key in frontend/APK/repository. The existing generous web-search cap is not an official API quota manager; configure that when switching.

Sources: https://github.com/Malith-Rukshan/PyTubeSearch ; https://developers.google.com/youtube/iframe_api_reference ; https://supabase.com/docs/guides/functions
