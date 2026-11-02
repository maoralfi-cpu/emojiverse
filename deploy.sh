#!/usr/bin/env bash
# פריסה/עדכון של "כובש".
#   ./deploy.sh            -> GitHub Pages (ראשי): https://maoralfi-cpu.github.io/kovesh/
#   ./deploy.sh --flypod   -> גם ל-flypod.dev (גיבוי זמני, פג 14 יום בלי login)
# מריץ בדיקות, מעדכן את גרסת המטמון ב-sw.js (כדי שהטלפון יקבל את העדכון), עושה commit ו-push.
set -euo pipefail
cd "$(dirname "$0")"
PAGES_URL="https://maoralfi-cpu.github.io/kovesh"
node test/logic.test.js >/dev/null || { echo "בדיקות הלוגיקה נכשלו – לא פורסים"; exit 1; }
node test/net.test.js >/dev/null || { echo "בדיקות הרשת נכשלו – לא פורסים"; exit 1; }
STAMP=$(date +%Y%m%d%H%M%S)
sed -i "s/const VERSION = 'kovesh-[^']*'/const VERSION = 'kovesh-${STAMP}'/" sw.js
grep -q "kovesh-${STAMP}" sw.js || { echo "עדכון גרסת המטמון נכשל"; exit 1; }
git add -A
git -c user.name="maoralfi-cpu" -c user.email="maoralfi-cpu@users.noreply.github.com" commit -qm "פריסה kovesh-${STAMP}" || true
git push -q origin HEAD:main
echo "נדחף ל-GitHub. ממתין לבניית Pages..."
for i in $(seq 1 60); do
  if curl -s "$PAGES_URL/sw.js" | grep -q "kovesh-${STAMP}"; then echo "Pages מעודכן"; break; fi
  sleep 5
done
for f in "" manifest.webmanifest sw.js icons/icon-512.png js/mp.js js/net.js js/vendor/peerjs.min.js; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$PAGES_URL/$f")" "$PAGES_URL/$f"
done

if [[ "${1:-}" == "--flypod" ]]; then
  rm -rf dist && mkdir dist && cp -r index.html style.css manifest.webmanifest sw.js js icons dist/
  if [[ -s .deploy-site ]]; then npx -y flypod@latest update dist --site "$(cat .deploy-site)"
  else npx -y flypod@latest dist; fi
fi
echo "גרסה: kovesh-${STAMP}"
