# Desktop login investigation

Live desktop Chromium at 1366×768 loads the site, login form and assets without script/request errors or overflow. Synthetic intercepted auth tests show rejected credentials, network failure, and successful authentication reaching the diary PIN screen. No real account/password/PIN was tested.

The supplied screenshot contains an authentication error plus a separate password-reset email-format error. Confirmed UI bug: reset errors were being placed in the notice/success slot; starting a new sign-in did not clear that slot. Fixed mutually exclusive feedback, clearing it on edits/actions, serializing requests, request exceptions, and accessible visible error styling. Email edge whitespace is trimmed, malformed internal/hidden characters are rejected with a message. The password is unchanged. No credential reset sent. The actual authentication rejection cannot be attributed to a specific cause from this screenshot alone; it is not proof of a desktop restriction or a correct password.

The PIN keypad previously had no digit keyboard handler. It now accepts keyboard digits and Backspace/Delete, while ignoring modifiers, held-key repeats and editable controls. Existing enter-PIN auto-submit and server lockout remain. Setup/confirmation use explicit Continue/Set PIN, with Enter as keyboard equivalent. No PIN verification rules or saved secrets changed.

QA: synthetic feedback regression at 390/1366px; mocked auth/PIN status at desktop size verifies keyboard digits, Backspace and pointer keypad together. No actual account reads/writes/resets. Theme-color and safe-area colours unchanged.
