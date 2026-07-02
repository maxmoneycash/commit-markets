#!/usr/bin/env bash
# Builds commits.sh.app (a menu-bar app bundle) from the Swift package.
#   ./build-app.sh          → release build + assemble dist/commits.sh.app
#   open dist/commits.sh.app  to run it
set -euo pipefail
cd "$(dirname "$0")"

echo "▸ swift build -c release"
swift build -c release

APP="dist/commits.sh.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/CommitsSH "$APP/Contents/MacOS/CommitsSH"
cp Info.plist "$APP/Contents/Info.plist"

# Ad-hoc sign so Gatekeeper lets it run locally (distribution needs real
# signing + notarization with an Apple Developer account).
codesign --force --deep --sign - "$APP" 2>/dev/null || true

echo "▸ built $APP"
echo "  run:  open $APP   (icon appears in your menu bar)"
