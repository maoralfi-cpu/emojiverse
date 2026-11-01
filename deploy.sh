#!/usr/bin/env bash
# פריסה/עדכון של "כובש" לאחסון סטטי (flypod.dev) – ./deploy.sh
# בונה תיקיית dist עם הקבצים הציבוריים בלבד, מעדכן את גרסת המטמון ב-sw.js, ומעלה.
set -euo pipefail
cd "$(dirname "$0")"
FILES=(index.html style.css manifest.webmanifest sw.js js icons)
rm -rf dist && mkdir dist
cp -r "${FILES[@]}" dist/
STAMP=$(date +%Y%m%d%H%M%S)
sed -i "s/const VERSION = 'kovesh-[^']*'/const VERSION = 'kovesh-${STAMP}'/" dist/sw.js
grep -q "kovesh-${STAMP}" dist/sw.js || { echo "עדכון גרסת המטמון נכשל"; exit 1; }
# מוודאים שהבדיקות עוברות לפני פריסה
node test/logic.test.js >/dev/null || { echo "בדיקות הלוגיקה נכשלו – לא פורסים"; exit 1; }
STATE=.deploy-site   # מזהה האתר (לא סוד)
if [[ -s $STATE ]]; then
  npx -y flypod@latest update dist --site "$(cat $STATE)"
else
  OUT=$(npx -y flypod@latest dist 2>&1) ; echo "$OUT"
  URL=$(echo "$OUT" | grep -oE 'https://[a-z0-9]+\.flypod\.page' | head -1)
  [[ -n $URL ]] && echo "${URL#https://}" | cut -d. -f1 > $STATE && echo "$URL" > .deploy-url
fi
URL=$(cat .deploy-url 2>/dev/null || true)
[[ -n $URL ]] && for f in "" manifest.webmanifest sw.js icons/icon-512.png; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$URL/$f")" "$URL/$f"
done
echo "גרסה: kovesh-${STAMP}"
