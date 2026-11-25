# First-device acceptance checks

Use the signed candidate on Joydeep's phone first. Do not replace Aruba's working app until the checks pass. Keep the installed web app for rollback. Do not uninstall the web app or clear its data.

1. Install as an update only if package/signing key match. First install may require Allow from this source for the file-opening app. Turn that permission off afterward. No Play Store upload. Android 9+ and updated Android System WebView/Google Play Services.
2. Open Dear Diary. Sign in with the same account, then the existing diary PIN. Verify existing diary/profile/chat are present. No new account needed.
3. Try a screenshot and screen recording of a non-sensitive screen. Android should block capture or show blank app content. Check Recents preview. Do not treat this as protection against external cameras/rooted devices.
4. Settings -> Android app options: enable device gate. Leave and reopen. Try fingerprint, cancel, retry and phone screen-lock fallback. Inside diary PIN must still work. Do not turn on gate until the phone has a known working screen lock.
5. Enable Android notifications in the menu and allow Android notification permission. Background the app. Arrange one consented test message, not a bulk test. Notification should be generic. Tap it, unlock, verify correct account/chat. Do not share private screenshots.
6. Test existing image picker, mic recording -> cancel/review, GIF browsing and song playback. Do not send content automatically for testing. Test own backup/PDF export separately before relying on it; browser-only download/share flows may need more work in the wrapper.
7. Sign out and confirm later notifications for that account stop showing on this app. Sign in again if continuing.

Known limits: no notification inline reply in initial release; browser fingerprint/passkey shortcut is not migrated, use native gate plus diary PIN. System file picker supports selecting existing media; direct camera capture is device-dependent. Android power management/force-stop may delay push. The APK is a restricted WebView shell, not a full native rewrite or a security guarantee.
