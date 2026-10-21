#!/usr/bin/env bash
# Run from android-wrapper/ AFTER `npx cap add android`.
# Copies the MusicLibrary plugin in and adds the music permissions.
set -e
PKG=android/app/src/main/java/com/yaps/music
MANIFEST=android/app/src/main/AndroidManifest.xml
mkdir -p "$PKG"
cp plugin/MusicLibraryPlugin.java "$PKG/MusicLibraryPlugin.java"
cp plugin/MainActivity.java "$PKG/MainActivity.java"
if ! grep -q "READ_MEDIA_AUDIO" "$MANIFEST"; then
  sed -i 's#<application#<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n    <application#' "$MANIFEST"
fi
echo "MusicLibrary plugin + permissions installed."
