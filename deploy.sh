#!/usr/bin/env bash
# פריסה/עדכון של "Emojiverse".
#   ./deploy.sh            -> GitHub Pages (ראשי): https://maoralfi-cpu.github.io/emojiverse/
#   ./deploy.sh --flypod   -> גם ל-flypod.dev (גיבוי זמני, פג 14 יום בלי login)
# מריץ בדיקות, מעדכן את גרסת המטמון ב-sw.js (כדי שהטלפון יקבל את העדכון), עושה commit ו-push.
set -euo pipefail
cd "$(dirname "$0")"
PAGES_URL="https://maoralfi-cpu.github.io/emojiverse"
node test/logic.test.js >/dev/null || { echo "בדיקות הלוגיקה נכשלו – לא פורסים"; exit 1; }
node test/net.test.js >/dev/null || { echo "בדיקות הרשת נכשלו – לא פורסים"; exit 1; }
node test/fx.test.js >/dev/null || { echo "בדיקות האפקטים נכשלו – לא פורסים"; exit 1; }
node test/packs.test.js >/dev/null || { echo "בדיקות החבילות נכשלו – לא פורסים"; exit 1; }
STAMP=$(date +%Y%m%d%H%M%S)
# גרסת אפליקציה: מעלים את המספר המשני בכל פריסה (./deploy.sh --no-bump כדי לא להעלות)
APP=$(sed -n "s/.*app: 'v\([0-9]*\.[0-9]*\)'.*/\1/p" js/version.js)
if [[ " $* " != *" --no-bump "* ]]; then APP="${APP%.*}.$(( ${APP#*.} + 1 ))"; fi
sed -i "s/app: 'v[0-9.]*', build: '[^']*'/app: 'v${APP}', build: 'emojiverse-${STAMP}'/" js/version.js
grep -q "v${APP}', build: 'emojiverse-${STAMP}'" js/version.js || { echo "עדכון גרסת האפליקציה נכשל"; exit 1; }
sed -i "s/const VERSION = '[a-z]*-[^']*'/const VERSION = 'emojiverse-${STAMP}'/" sw.js
# מספר פריסה על כל קובץ JS/CSS ב-index.html – index חדש מושך קבצים חדשים גם מ-SW ישן
sed -i -E "s#(src=\"js/[a-z]+\.js)(\?v=[0-9]+)?\"#\1?v=${STAMP}\"#g; s#(href=\"style\.css)(\?v=[0-9]+)?\"#\1?v=${STAMP}\"#" index.html
grep -q "version.js?v=${STAMP}" index.html || { echo "הטבעת ?v נכשלה"; exit 1; }
grep -q "emojiverse-${STAMP}" sw.js || { echo "עדכון גרסת המטמון נכשל"; exit 1; }
git add -A
git -c user.name="maoralfi-cpu" -c user.email="maoralfi-cpu@users.noreply.github.com" commit -qm "פריסה v${APP} (emojiverse-${STAMP})" || true
git push -q origin HEAD:main
echo "נדחף ל-GitHub. ממתין לבניית Pages..."
for i in $(seq 1 60); do
  if curl -s "$PAGES_URL/sw.js" | grep -q "emojiverse-${STAMP}"; then echo "Pages מעודכן"; break; fi
  sleep 5
done
for f in "" manifest.webmanifest sw.js icons/icon-512.png js/mp.js js/net.js js/vendor/peerjs.min.js; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$PAGES_URL/$f")" "$PAGES_URL/$f"
done

if [[ " $* " == *" --flypod "* ]]; then
  rm -rf dist && mkdir dist && cp -r index.html style.css manifest.webmanifest sw.js js icons dist/
  if [[ -s .deploy-site ]]; then npx -y flypod@latest update dist --site "$(cat .deploy-site)"
  else npx -y flypod@latest dist; fi
fi
echo "גרסה: v${APP} | מטמון: emojiverse-${STAMP}"
