# Computer inactivity lock

Non-touch browsers with a fine pointer and hover, excluding mobile/tablet
user agents, lock after 120000ms without trusted pointer/click/key/input/wheel
activity. Window width is irrelevant. Passive mouse movement, incoming data,
programmatic scrolling and media playback don't keep it open. A wall-clock
check also runs on focus/pageshow/visibilitychange, so a throttled tab locks
when it resumes. Browser/OS suspension can delay all JavaScript execution.

The initial entry PIN is unchanged. The idle lock clears both diary unlock
flags and shows the existing own-diary PIN. It hides and makes the mounted
route inert instead of unmounting it. This keeps editor, chat, profile and
attachment drafts in memory. The StoreProvider and its existing autosave and
local fallback remain mounted. Unlock restores the route without bypassing
PIN verification. Nothing automatically sends. Closing/reloading the page
still has the app's existing persistence limits, especially unsent chat/media.

Open native dialogs are closed while locked and reopened after verification.
New dialogs are kept closed behind the lock. Chat seen updates and incoming
banners are suspended. Audio/video pause; song requests are invalidated;
voice capture stops into an unsent preview and releases the microphone.
Voice-lock listening pauses until unlock. Playback never resumes by itself.

QA: synthetic sign-in/PIN/data only, fake media input only. Checked 119s vs
120s, key and wheel reset, repeated lock/unlock, narrow computer, touch phone
and 1366px touch tablet exclusions, delayed timer, chat draft, diary text,
active recorder to unsent preview, and unchanged theme-color. No real rows,
accounts, PIN attempts or sends. No theme or safe-area changes.
