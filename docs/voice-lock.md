# Voice lock

Settings has an account-and-browser-local toggle, off by default. A provider above the app PIN gate manages SpeechRecognition/webkitSpeechRecognition with en-IN, continuous final results only. Whole-word English lock returns to the existing app-entry PIN screen and clears both diary session unlock flags. The unlock word takes precedence and only disables the feature. No voice command can satisfy the PIN gate. While PIN-locked the recognizer is stopped, so unlock is not heard there.

Only enabled + unlocked + visible + focused sessions listen. Hide, blur, pagehide, lock, toggle off and provider cleanup abort recognition. No transcript or audio is stored or sent to the diary backend. Browser speech recognition may send audio, including surrounding conversation, to Google/browser speech services. Permission/support/network errors stop with a short message and explicit Resume; brief normal ends restart with a delay, repeated immediate ends stop. Voice-note recording pauses recognition until Resume to avoid mic competition. The feature can restart after a successful PIN entry if still enabled.

A persistent Mic on / paused status and Off control are shown, plus the browser/OS permission and microphone indicators. Rules explain privacy, battery, false triggers, recorded/nearby speech, accent limits and unsent-draft/recording loss on lock. This is best-effort convenience, not identity recognition, guaranteed emergency protection or a substitute for the phone lock. Final-result latency means lock is not instantaneous at the sound of the word. English only; Bengali commands not added.

Source checked:
https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
Limited browser support; some engines send audio to a server and require network.

Synthetic mocked-recognizer tests: zero starts by default, English token/interim guards, hide stops/show resumes, lock stops and returns gate, unlock cannot open gate, unlock turns toggle off only, denial/retry, voice-note pause and Off abort. Actual AppEntryGate wiring was tested using a temporary synthetic PIN component, with flags cleared, content removed and mic stopped. No real PIN, speech, microphone, accounts or chats used. Paper/midnight settings pixels inspected. Physical Android microphone permissions, browser/PWA restarting, speech recognition latency and Bengali-accent accuracy remain unverified.
