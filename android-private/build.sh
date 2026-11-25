#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Set ANDROID_HOME}"
: "${JAVA_HOME:?Set JAVA_HOME}"
gradle --no-daemon assembleRelease
if [[ -n "${KEYSTORE_PATH:-}" ]]; then
 "$ANDROID_HOME/build-tools/35.0.0/apksigner" sign --ks "$KEYSTORE_PATH" --ks-pass "file:$KEYSTORE_PASSWORD_FILE" --ks-key-alias diary --out build/Dear-Diary-1.0.apk build/outputs/apk/release/DearDiaryPrivate-release-unsigned.apk
 "$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose build/Dear-Diary-1.0.apk
fi
