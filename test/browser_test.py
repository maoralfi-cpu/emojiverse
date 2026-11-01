#!/usr/bin/env python3
"""בדיקת דפדפן: /home/box/factory/tools/.venv/bin/python test/browser_test.py [URL]
מריץ את המשחק ב-Chromium בתצוגת טלפון, בודק שגיאות קונסול, SW, ומצלם."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8765/'
errors, results = [], {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True,
                            user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36')
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        reqs = []
        pg.on('request', lambda r: reqs.append(r.url))
        pg.goto(url, wait_until='load')
        pg.screenshot(path=os.path.join(ROOT, 'test', 'menu.png'))
        pg.click('#avatarPick button:nth-child(3)')
        pg.click('#playBtn')
        # משחק: מזיזים את השחקן בהחלקות/מקשים כדי שיכבוש קצת
        for d in ['ArrowRight']*1:
            pg.keyboard.press(d)
        seq = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
        for i, k in enumerate(seq):
            pg.keyboard.press(k); pg.wait_for_timeout(700)
        pg.wait_for_timeout(1500)
        st = pg.evaluate('''() => { const k = window.__kovesh, g = k.game, me = k.me;
            return { state: k.state, alive: me.alive, pct: g.pct(me), tick: g.tickNo, bots: g.players.filter(p=>p.isBot).length,
                     botsAlive: g.players.filter(p=>p.isBot && p.alive).length, dpr: document.getElementById('game').width / innerWidth }; }''')
        results['state'] = st
        if st['state'] == 'play':
            pg.screenshot(path=os.path.join(ROOT, 'screenshot.png'))
        # השהיה עם P
        pg.keyboard.press('KeyP'); pg.wait_for_timeout(200)
        t1 = pg.evaluate('window.__kovesh.game.tickNo'); pg.wait_for_timeout(600)
        t2 = pg.evaluate('window.__kovesh.game.tickNo')
        results['pause_stops_ticks'] = (t1 == t2) and pg.evaluate('window.__kovesh.state') == 'paused'
        # מדידת קצב פריימים בפועל (ציפייה ~30)
        pg.click('#resumeBtn')
        fps = pg.evaluate('''() => new Promise(r => { let n = 0, t0 = performance.now(); const o = CanvasRenderingContext2D.prototype.fillRect;
            const c = document.getElementById('game').getContext('2d'); const orig = c.fillRect.bind(c);
            c.fillRect = function(...a){ if (a[0]===0 && a[1]===0) n++; return orig(...a); };
            setTimeout(() => { c.fillRect = orig; r(n / ((performance.now()-t0)/1000)); }, 2000); })''')
        results['render_fps'] = round(fps, 1)
        # Service worker
        pg.wait_for_timeout(500)
        results['sw'] = pg.evaluate('navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r => !!(r && (r.active||r.installing||r.waiting))) : false')
        results['external_requests'] = sorted(set(u for u in reqs if not u.startswith(url) and not u.startswith('data:') and not u.startswith('blob:') and 'cloudflareinsights' not in u))
        # מסך סוף: מתאבדים בקיר
        if pg.evaluate('window.__kovesh.state') == 'play':
            pg.evaluate('''() => { const g = window.__kovesh.game, me = window.__kovesh.me; g.kill(me, null, 'wall'); }''')
            pg.wait_for_timeout(300)
        pg.wait_for_timeout(1500)
        results['over_visible'] = pg.is_visible('#over')
        pg.screenshot(path=os.path.join(ROOT, 'test', 'gameover.png'))
        # מצב לא מקוון
        ctx.set_offline(True)
        pg.reload(wait_until='load')
        results['offline_reload_ok'] = pg.is_visible('#playBtn')
        ctx.set_offline(False)
        b.close()
finally:
    if srv: srv.terminate()
# חסימת סקריפט צד-שלישי שהאחסון מזריק היא התנהגות רצויה (CSP), לא שגיאת משחק
blocked = [e for e in errors if 'Content Security Policy' in e]
errors = [e for e in errors if e not in blocked]
results['csp_blocked_third_party'] = len(blocked)
results['console_errors'] = errors
print(json.dumps(results, ensure_ascii=False, indent=1))
ok = not errors and results.get('pause_stops_ticks') and results.get('over_visible') and not results['external_requests']
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
