# Private Android update channel

APK 1.5 is the first updater-enabled build. Older APKs need one manual install.
The update endpoint requires an active signed-in user. Metadata is in an RLS-
protected table with no anon/authenticated table privileges. The private bucket
stays private. The function signs only the latest active release on download,
for ten minutes. Download URLs must never be committed to source.

For each future release:
1. Bump Gradle + Manifest versionCode/versionName and workflow APK filename.
2. Set android-private/release.json to the same code/version and user-readable notes.
3. Test and deploy the web/native changes. Build and sign through the existing
   private Android workflow, using the same signing key. Download its APK.
4. Verify the artifact and then publish it:
   python3 scripts/publish-android-release.py --apk PATH --token-file APPROVED_TOKEN_FILE --build-tools ANDROID_BUILD_TOOLS_DIRECTORY
5. The helper verifies signer/package/version, uploads to private storage,
   downloads and hashes the full object, and inserts immutable release metadata.
   It refuses duplicate/lower version codes. Verify the authenticated endpoint
   returns the new release to older clients and no update to current clients.
6. Clean temporary credentials. A manual private link may be made separately as
   a recovery path. Publishing the channel does not notify or message anyone.

Rollback by setting the bad metadata row active=false through an authorized
admin operation. Existing clients must never install a lower/same version code.
For a replacement fix, increment the code and publish a new signed APK.

Installer constraints: Android confirmation and install-source permission remain.
No silent install or guaranteed auto-restart. Downloaded cache files are private,
shared only with Android's installer via a read-only FileProvider URI, and deleted
on next process start. Hash, package ID, strictly newer code and installed signer
are checked before installer launch. Android performs final package verification.
