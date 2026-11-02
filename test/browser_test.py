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
        results['emoji_picker_count'] = pg.evaluate("document.querySelectorAll('#avatarPick button.emo').length")
        results['emoji_default_random'] = pg.evaluate("document.querySelector('#avatarPick button.on').classList.contains('rnd')")
        pg.click('#avatarPick button:nth-child(3)')
        results['emoji_saved'] = pg.evaluate("JSON.parse(localStorage.getItem('kovesh.settings')).emoji")
        pg.evaluate("document.getElementById('avatarPick').scrollIntoView({block:'center'})")
        pg.screenshot(path=os.path.join(ROOT, 'test', 'emoji_picker.png'))
        pg.click('#playBtn')
        results['me_emoji'] = pg.evaluate('window.__kovesh.me.emoji')
        results['bot_emojis_unique'] = pg.evaluate("(()=>{const e=window.__kovesh.game.players.map(p=>p.emoji);return new Set(e).size===e.length})()")
        # משחק: לולאה עם חיצים מוחזקים כדי לכבוש שטח
        for k, ms in [('ArrowRight', 900), ('ArrowDown', 900), ('ArrowLeft', 900), ('ArrowUp', 1100)]:
            pg.keyboard.down(k); pg.wait_for_timeout(ms); pg.keyboard.up(k)
        # גרירה: כיוון המטרה צריך להתאים לזווית הגרירה (360°)
        # הצבעה (v4): נגיעה בזווית 45° מהדמות (מרכז המסך) => כיוון היעד 45° מיד בנגיעה
        results['died_in_key_loop'] = pg.evaluate('window.__kovesh.state') != 'play'
        if results['died_in_key_loop']:
            pg.evaluate('window.__kovesh.start()'); pg.wait_for_timeout(600)
        cx, cy = 206, 457.5
        pg.mouse.move(cx + 70, cy + 70); pg.mouse.down()
        ang = pg.evaluate('window.__kovesh.me.target')
        pg.mouse.move(cx - 80, cy + 80, steps=6)
        ang2 = pg.evaluate('window.__kovesh.me.target')
        pg.mouse.up()
        pg.touchscreen.tap(cx - 120, cy)
        ang3 = pg.evaluate('window.__kovesh.me.target')
        results['drag_45deg_target'] = round(ang, 2)
        results['point_135deg_after_slide'] = round(ang2, 2)
        results['touch_tap_left'] = round(ang3, 2)
        import math
        results['drag_ok'] = abs(ang - 0.785) < 0.1 and abs(ang2 - 2.356) < 0.15 and abs(abs(ang3) - math.pi) < 0.1
        # מחזירים את השחקן הביתה (בעזרת היגוי לנקודת הבית) ומחכים שהבוטים יכבשו
        pg.evaluate("""() => new Promise(r => { const me = window.__kovesh.me; let n = 0;
            const t = setInterval(() => { const g = window.__kovesh.game; me.target = Math.atan2(g.wd(me.homeY - me.y), g.wd(me.homeX - me.x)); if (!me.trail.length || ++n > 120) { clearInterval(t); r(); } }, 50); })""")
        pg.evaluate("""() => new Promise(r => { const me = window.__kovesh.me; let n = 0;
            const t = setInterval(() => { me.target = me.h + 0.08; if (++n > 140) { clearInterval(t); r(); } }, 50); })""")
        st = pg.evaluate('''() => { const k = window.__kovesh, g = k.game, me = k.me;
            return { state: k.state, alive: me.alive, pct: +g.pct(me).toFixed(2), tick: g.tickNo, bots: g.players.filter(p=>p.isBot).length, trailPts: me.trail.length/2, heading: +me.h.toFixed(2),
                     botsAlive: g.players.filter(p=>p.isBot && p.alive).length, dpr: document.getElementById('game').width / innerWidth }; }''')
        results['state'] = st
        if st['state'] == 'play':
            pg.screenshot(path=os.path.join(ROOT, 'screenshot.png'))
        # אם השחקן נפסל במהלך התסריט (בוט/קיר) – מתחילים משחק חדש כדי להמשיך לבדוק
        results['died_during_script'] = st['state'] != 'play'
        results['death_reason'] = pg.evaluate("(document.getElementById('over')||{}).innerText||''")[:120] if st['state'] != 'play' else ''
        if st['state'] != 'play':
            pg.evaluate('window.__kovesh.start()'); pg.wait_for_timeout(1200)
            pg.screenshot(path=os.path.join(ROOT, 'screenshot.png'))
        # השהיה עם P (אם השחקן נפסל בינתיים – משחק חדש)
        if pg.evaluate('window.__kovesh.state') != 'play':
            pg.evaluate('window.__kovesh.start()'); pg.wait_for_timeout(300)
        pg.keyboard.press('KeyP'); pg.wait_for_timeout(200)
        t1 = pg.evaluate('window.__kovesh.game.tickNo'); pg.wait_for_timeout(600)
        t2 = pg.evaluate('window.__kovesh.game.tickNo')
        results['pause_stops_ticks'] = (t1 == t2) and pg.evaluate('window.__kovesh.state') == 'paused'
        # מדידת קצב פריימים בפועל (ציפייה ~60 בזמן משחק)
        pg.click('#resumeBtn')
        fps = pg.evaluate('''() => new Promise(r => { const f0 = window.__kovesh.frames, t0 = performance.now();
            setTimeout(() => r((window.__kovesh.frames - f0) / ((performance.now() - t0) / 1000)), 2000); })''')
        results['render_fps'] = round(fps, 1)
        # Service worker
        pg.wait_for_timeout(500)
        results['sw'] = pg.evaluate('navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r => !!(r && (r.active||r.installing||r.waiting))) : false')
        results['external_requests'] = sorted(set(u for u in reqs if not u.startswith(url) and not u.startswith('data:') and not u.startswith('blob:') and 'cloudflareinsights' not in u))
        # מסך סוף: פסילה מלאכותית (אין קירות בטורוס)
        if pg.evaluate('window.__kovesh.state') == 'play':
            pg.evaluate('''() => { const g = window.__kovesh.game, me = window.__kovesh.me; g.kill(me, null, 'self'); }''')
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
ok = results.get('emoji_picker_count', 0) >= 37 and results.get('emoji_default_random') and results.get('me_emoji') == results.get('emoji_saved') == '🦊' and results.get('bot_emojis_unique') and results.get('drag_ok') and 45 <= results.get('render_fps', 0) <= 66 and not errors and results.get('pause_stops_ticks') and results.get('over_visible') and not results['external_requests']
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
