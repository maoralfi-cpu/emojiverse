#!/usr/bin/env python3
"""v7: נסיעה דרך שני התפרים של הטורוס בדפדפן – בלי מוות, מיקום ומצלמה רציפים, צילומים.
/home/box/factory/tools/.venv/bin/python test/seam_test.py [URL]"""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8767', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8767/'
errs, res = [], {}
SHOT = os.path.join(ROOT, 'test', 'shots')
os.makedirs(SHOT, exist_ok=True)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errs.append(m.text))
        pg.goto(url, wait_until='load')
        pg.evaluate("localStorage.setItem('kovesh.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('kovesh.settings')||'{}'), {bots:0, size:80})))")
        pg.reload(wait_until='load')
        pg.click('#playBtn'); pg.evaluate('window.__kovesh.pits.reset()'); pg.wait_for_timeout(300)
        # מתחילים ליד הפינה (78,75) – גם השטח ההתחלתי חוצה את תפר x ונוסעים באלכסון: חוצים את תפר x ואת תפר y
        pg.evaluate("""() => { const k = window.__kovesh, g = k.game, me = k.me;
            g.spawn(me, { x: 78, y: 75 }); me.h = me.target = Math.PI / 4 - 0.25; }""")
        # מקליטים בכל פריים: מיקום, מצלמה, חיים
        pg.evaluate("""() => { window.__rec = []; const k = window.__kovesh;
            (function f() { const me = k.me; if (!k.game) return; window.__rec.push([me.x, me.y, k.cam[0], k.cam[1], me.alive ? 1 : 0, k.state]);
              me.target = Math.PI / 4 - 0.25; if (window.__rec.length < 2000) requestAnimationFrame(f); })(); }""")
        # צילום אחרי חציית תפר x (השובל משני צדי התפר)
        shot_x = shot_y = False
        for i in range(120):
            pg.wait_for_timeout(25)
            x, y = pg.evaluate("[window.__kovesh.me.x, window.__kovesh.me.y]")
            if not shot_x and 4 < x < 7:
                pg.screenshot(path=os.path.join(SHOT, 'seam_cross_x.png')); shot_x = True
            if not shot_y and 0.2 < y < 4 and x < 20:
                pg.screenshot(path=os.path.join(SHOT, 'seam_cross_y.png')); shot_y = True
            if shot_x and shot_y: break
        pg.wait_for_timeout(300)
        rec = pg.evaluate("window.__rec")
        W = 80
        def wd(d): d %= W; return d - W if d > W / 2 else d
        jumps = [((rec[i][0] - rec[i-1][0]), (rec[i][1] - rec[i-1][1])) for i in range(1, len(rec))]
        res['frames'] = len(rec)
        res['crossed_x'] = sum(1 for dx, dy in jumps if abs(dx) > W / 2)
        res['crossed_y'] = sum(1 for dx, dy in jumps if abs(dy) > W / 2)
        res['max_wrapped_step'] = round(max(max(abs(wd(dx)), abs(wd(dy))) for dx, dy in jumps), 3)
        cj = [max(abs(rec[i][2] - rec[i-1][2]), abs(rec[i][3] - rec[i-1][3])) for i in range(4, len(rec))]   # אחרי ההתייצבות על נקודת ההתחלה
        res['max_camera_step'] = round(max(cj), 3)          # מצלמה רציפה – בלי קפיצה של W
        res['always_alive'] = all(r[4] == 1 for r in rec) and all(r[5] == 'play' for r in rec)
        tr = pg.evaluate("window.__kovesh.me.trail")
        res['trail_points'] = len(tr) // 2
        res['trail_max_seg'] = round(max((((tr[k+2]-tr[k])**2 + (tr[k+3]-tr[k+1])**2) ** .5 for k in range(0, len(tr) - 3, 2)), default=0), 3)
        res['shots'] = [shot_x, shot_y]
        b.close()
finally:
    if srv: srv.terminate()
res['errors'] = errs
print(json.dumps(res, ensure_ascii=False, indent=1))
ok = res['crossed_x'] >= 1 and res['crossed_y'] >= 1 and res['always_alive'] and res['max_wrapped_step'] < 0.6 and res['max_camera_step'] < 0.6 and res['trail_max_seg'] < 1 and all(res['shots']) and not errs
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
