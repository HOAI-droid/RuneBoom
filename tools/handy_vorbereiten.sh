#!/usr/bin/env bash
# Android- und iOS-Projekt mit Capacitor anlegen und auf Querformat stellen (für die GitHub-Action und lokal).
# Aufruf: tools/handy_vorbereiten.sh android|ios
set -euo pipefail
ziel="$1"
npm install --no-save @capacitor/cli@8.6.0 @capacitor/core@8.6.0 "@capacitor/$ziel@8.6.0"
[ -d "$ziel" ] || npx cap add "$ziel"
npx cap sync "$ziel"
# App-Symbol aus resources/ (icon.png, icon-foreground.png, icon-background.png); scheitert es, bleibt das Standardsymbol
npx --yes @capacitor/assets@3.0.5 generate --"$ziel" --iconBackgroundColor '#3a2f4a' --iconBackgroundColorDark '#3a2f4a' || echo "Hinweis: App-Symbol nicht erzeugt"
if [ "$ziel" = android ]; then
  m=android/app/src/main/AndroidManifest.xml
  grep -q 'screenOrientation' "$m" || sed -i.bak 's|<activity|<activity android:screenOrientation="sensorLandscape"|' "$m"
  rm -f "$m.bak"
  grep -o 'android:screenOrientation="[a-zA-Z]*"' "$m"
else
  p=ios/App/App/Info.plist
  for k in UISupportedInterfaceOrientations UISupportedInterfaceOrientations~ipad; do
    /usr/libexec/PlistBuddy -c "Delete :$k" "$p" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Add :$k array" -c "Add :$k:0 string UIInterfaceOrientationLandscapeLeft" -c "Add :$k:1 string UIInterfaceOrientationLandscapeRight" "$p"
  done
  /usr/libexec/PlistBuddy -c "Add :UIStatusBarHidden bool true" "$p" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :UIRequiresFullScreen bool true" "$p" 2>/dev/null || true
fi
