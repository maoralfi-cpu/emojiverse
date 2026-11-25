#!/usr/bin/env python3
"""v9.23 תיקון אפקט רדאר פעיל: בלי טבעת תכלת, שוליים בצבע השטח.
שומר צילום ל-/workspace/v923_radar.png."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v923_radar.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8783', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, fails = [], []
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8783/', wait_until='load')
        pg.wait_for_timeout(500)
        pg.click('#playBtn')
        ready = False
        for _ in range(40):
            pg.wait_for_timeout(100)
            st = pg.evaluate("() => { try { const k = window.__kovesh; if (k && k.state==='play' && k.me && k.game) { const me=k.me, cx=me.homeX!=null?me.homeX:me.x, cy=me.homeY!=null?me.homeY:me.y; me.invulnUntil=1e9; if (k.pits) k.pits.pits.length=0; me.x=me.px=cx; me.y=me.py=cy; me.trail.length=0; return true; } } catch(e) {} return false; }")
            if st:
                ready = True
                break
        check(ready, 'המשחק התחיל')
        applied = pg.evaluate("""() => {
          const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
          packs.packs.length = 0; packs.spawnCD = 1e9;
          if (k.pits) k.pits.pits.length = 0;
          const cx = me.homeX != null ? me.homeX : me.x, cy = me.homeY != null ? me.homeY : me.y;
          me.invulnUntil = 1e9; me.alive = true;
          g.players.forEach(p => { if (p !== me) { p.x = p.px = 2; p.y = p.py = 2; p.trail.length = 0; } });
          me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0; me.h = me.target = -Math.PI / 2;
          window.__lock = window.__lock || setInterval(() => {
            if (!me.alive) return;
            me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0;
          }, 30);
          packs.apply(g, me, 'radar', g.tickNo);
          const c = me.color;
          const hex = c && c[0] === '#' ? c : '#000000';
          return { active: packs.activeOf(me.id) && packs.activeOf(me.id).effectId, color: hex, alive: me.alive, state: k.state };
        }""")
        check(applied['active'] == 'radar' and applied['alive'] and applied['state']=='play', 'אפקט 📡 הוחל')
        # ממתין לסיום הפייד-אין (~500ms) ולסיום הפינג הראשון (אחרי 900ms) כדי לראות את השוליים יציבים
        pg.wait_for_timeout(1300)
        sample = pg.evaluate("""() => {
          const canvas = document.getElementById('game');
          const x = canvas.getContext('2d');
          const w = canvas.width, h = canvas.height;
          function pix(px, py) {
            const d = x.getImageData(Math.max(0, Math.min(w - 1, px)), Math.max(0, Math.min(h - 1, py)), 1, 1).data;
            return [d[0], d[1], d[2], d[3]];
          }
          function hexRgb(h) {
            h = (h || '#000').replace('#', '');
            if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
            return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
          }
          const me = window.__kovesh.me;
          const pr = hexRgb(me.color);
          // פינות המסך – אמורות להיות בצבע השטח, לא שחור
          const corners = [pix(8, 8), pix(w - 8, 8), pix(8, h - 8), pix(w - 8, h - 8)];
          function dist(a, b) { return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]); }
          const black = [14, 30, 28], near = corners.map(c => dist(c, pr)), farB = corners.map(c => dist(c, black));
          // חיפוש טבעת תכלת (120,255,190) בכל המסך בדגימה דלילה
          let teal = 0, total = 0;
          for (let y = 4; y < h; y += 6) for (let xx = 4; xx < w; xx += 6) {
            const d = x.getImageData(xx, y, 1, 1).data; total++;
            if (d[1] > 200 && d[2] > 140 && d[0] < 180 && d[1] - d[0] > 60) teal++;
          }
          return { pr, corners, near, farB, teal, total, w, h };
        }""")
        print(json.dumps(sample, ensure_ascii=False))
        # כל פינה קרובה יותר לצבע השחקן מאשר לשחור-ירקרק הישן
        closer = all(n < 40 and n + 25 < f for n, f in zip(sample['near'], sample['farB']))
        check(closer, 'השוליים בצבע השטח (לא שחור): near=%s farBlack=%s' % (sample['near'], sample['farB']))
        check(sample['teal'] < 8, 'אין טבעת תכלת (פיקסלים חשודים: %s/%s)' % (sample['teal'], sample['total']))
        os.makedirs(os.path.dirname(SHOT) or '.', exist_ok=True)
        pg.screenshot(path=SHOT, full_page=False)
        check(os.path.isfile(SHOT) and os.path.getsize(SHOT) > 10000, 'צילום נשמר: ' + SHOT)
        ctx.close(); b.close()
finally:
    srv.terminate()
check(not errors, 'בלי שגיאות דף ' + (json.dumps(errors, ensure_ascii=False) if errors else ''))
print('PASS' if not fails else 'FAIL: ' + json.dumps(fails, ensure_ascii=False))
sys.exit(1 if fails else 0)
