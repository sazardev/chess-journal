#!/usr/bin/env bash
# Install the freshly-built universal APK on the running emulator, launch the
# app and capture a screenshot. Kept as a single script so shell variables
# survive across steps — android-emulator-runner runs each `script:` line in
# its own `sh -c`, which would otherwise drop `$APK`.
set -euo pipefail

APK=$(find src-tauri/gen/android/app/build/outputs/apk -name "*universal*.apk" | head -1)
if [ -z "$APK" ]; then
  echo "No universal APK found under src-tauri/gen/android/app/build/outputs/apk" >&2
  find src-tauri/gen/android/app/build/outputs/apk -name "*.apk" >&2 || true
  exit 1
fi
echo "Installing $APK"
adb install -r "$APK"

AAPT=$(find "$ANDROID_HOME/build-tools" -name aapt | sort | tail -1)
PKG=$("$AAPT" dump badging "$APK" | sed -n "s/.*package: name='\([^']*\)'.*/\1/p")
echo "Launching $PKG"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 || true

# Give the WebView time to load the bundled frontend before the screenshot.
sleep 16
adb exec-out screencap -p > emulator-screenshot.png
echo "Screenshot saved to emulator-screenshot.png"
