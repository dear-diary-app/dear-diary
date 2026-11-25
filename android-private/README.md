# Dear Diary private Android wrapper

Release package: `com.deardiary.privateapp`, Android 9 or newer. Not uploaded to any app store.

The app loads the existing HTTPS site and uses its existing Supabase accounts and data. Login is separate from Chrome. This is a native shell, not a native rewrite. Web updates arrive from the hosted site; native shell updates require a newly signed APK with a higher version code.

## Controls

Settings -> Android app options: optional device gate, reload, Android notifications. The gate is additional to the diary PIN, not a replacement for server verification. Android 11+ uses strong biometrics or device credentials; Android 9/10 uses device credentials. Device gate locks on backgrounding, with a shield. Cancel leaves a retry/close screen.

## Security

FLAG_SECURE on the activity, screenshot preview disabled on Android 13+, WebView debugging off, release build, no cleartext traffic or mixed content, no file URL access, no arbitrary JavaScript interfaces. The message bridge only accepts the hosted site's origin in the top frame. External HTTPS navigation leaves the WebView. SSL errors are not bypassed. Backups disabled. Runtime microphone/camera permission requests grant only those two named resources. Files use the system picker, without broad storage permission.

Native push uses FCM data-only messages containing an account ID and category, never diary/chat text. Notifications are generic and suppressed for a different signed-in account. Categories use existing backend preferences. No analytics is added. Android notification permission and opt-in are required. Google Play Services/network, OS power management, and force-stop settings affect delivery. Notification replies are not supported in this first native version.

Browser WebAuthn setup is not migrated. Use the native device gate plus diary PIN. System file picking is implemented, but direct capture is device dependent. Browser-only exports/share/install paths may need further native work.

## Build and keys

JDK 17, Android SDK 35/build-tools 35.0.0, Gradle 8.10.2. Place Firebase `google-services.json` here (ignored by git). Signing key and password are encrypted GitHub Actions secrets: `ANDROID_RELEASE_KEYSTORE` (base64 PKCS12) and `ANDROID_RELEASE_STORE_PASSWORD`. Do not rotate or lose them: updates must use the same signing key. They are never in repository source or app assets. The signing password also has a dedicated vault entry.

Compile: `gradle --no-daemon assembleRelease`. Sign with `apksigner` using the keystore and password-file inputs; never put secrets in command text or logs.

## Verification boundary

Compilation and Android lint can be checked here, plus signing/manifest inspection and isolated web/backend tests. A physical Android device is still required to verify screen-capture protection, Recents behavior, biometric prompts, hardware media permissions, FCM delivery and device-specific UI. No real user content is used in QA.
