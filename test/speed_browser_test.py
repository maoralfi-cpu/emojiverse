"""v9.18 מצב אקסטרים – בדיקת דפדפן (טלפון 412x915).
הרצה: /home/box/factory/tools/.venv/bin/python test/speed_browser_test.py [--shots DIR]
סולו: ברירת מחדל רגיל, בחירה ב"מצב אקסטרים" נשמרת, המשחק רץ ב-×1.5 והדמות באמת זזה מהר יותר.
אונליין (צינור מקומי): המארח בוחר מצב אקסטרים, הלקוח רואה את הבחירה (לקריאה בלבד), וכל המשחקים (כולל מצטרף באמצע) ב-×1.5.
וגם: ההודעה הכללית לכשל חיבור לא מזכירה "אותה רשת"/Hotspot."""
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else os.path.join(ROOT, 'test', 'shots')
os.makedirs(SHOTS, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8779', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); url = 'http://127.0.0.1:8779/'
fails, errs = [], []
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
def poll(pg, js, ms=15000):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        try:
            if pg.evaluate('()=>{try{return !!(' + js + ')}catch(e){return false}}'): return True
        except Exception: pass
        pg.wait_for_timeout(100)
    return False
FAST = 9.75 * 1.5
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        def mkctx(): return b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        print('סולו')
        ctx = mkctx(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append('solo: ' + str(e)))
        pg.goto(url); pg.wait_for_timeout(500)
        check(pg.evaluate("document.querySelector('#speedSeg button.on').dataset.v") == 'normal', 'ברירת מחדל: מהירות רגילה')
        pg.click('#playBtn'); poll(pg, "window.__kovesh.state==='play'")
        check(abs(pg.evaluate('window.__kovesh.game.SPEED') - 9.75) < 1e-9, 'משחק רגיל: SPEED=9.75')
        pg.goto(url); pg.wait_for_timeout(400)
        pg.click('#speedSeg button[data-v="fast"]')
        pg.goto(url); pg.wait_for_timeout(500)
        check(pg.evaluate("document.querySelector('#speedSeg button.on').dataset.v") == 'fast', 'הבחירה "מצב אקסטרים" נשמרת אחרי טעינה מחדש')
        pg.screenshot(path=os.path.join(SHOTS, 'v918_menu_412x915.png'))
        pg.click('#playBtn'); poll(pg, "window.__kovesh.state==='play'")
        check(abs(pg.evaluate('window.__kovesh.game.SPEED') - FAST) < 1e-9, 'משחק מהיר: SPEED=%.3f' % FAST)
        check('מצב אקסטרים' in pg.evaluate("document.getElementById('feed').textContent"), 'הודעת "מצב אקסטרים" בתחילת המשחק')
        # מהירות אמיתית: מרחק לאורך ~1 שנייה של צעדים (לפי tickNo)
        d = pg.evaluate("""() => new Promise(r => { const k = window.__kovesh, g = k.game, m = k.me; const x0 = m.x, y0 = m.y, t0 = g.tickNo;
            setTimeout(() => { const dx = Game.wrapDelta(m.x - x0, g.W), dy = Game.wrapDelta(m.y - y0, g.W); r([Math.hypot(dx, dy), g.tickNo - t0, m.alive, m.speedMul || 1]); }, 700); })""")
        if d[2] and d[1] > 10:
            v = d[0] / (d[1] / 60) / d[3]
            check(abs(v - FAST) < FAST * 0.12, 'הדמות זזה ~%.1f יח\'/ש\' (מצופה %.2f; ייתכן סיבוב)' % (v, FAST))
        ctx.close()

        print('אונליין (צינור מקומי)')
        ctx = mkctx()
        host = ctx.new_page(); cli = ctx.new_page()
        for n, q in (('host', host), ('cli', cli)): q.on('pageerror', lambda e, n=n: errs.append(n + ': ' + str(e)))
        host.goto(url + '?transport=local'); host.wait_for_timeout(300)
        host.click('#onlineBtn'); host.click('#hostBtn')
        check(poll(host, "document.getElementById('roomCode').textContent.length===4 && !document.getElementById('lobby').classList.contains('hidden')"), 'המארח פתח חדר')
        code = host.evaluate("document.getElementById('roomCode').textContent")
        check(host.evaluate("document.querySelector('#mpSpeedSeg button.on').dataset.v") == 'normal', 'לובי: ברירת מחדל רגיל')
        host.click('#mpSpeedSeg button[data-v="fast"]')
        cli.goto(url + '?transport=local&room=' + code)
        check(poll(cli, "!document.getElementById('lobby').classList.contains('hidden')", 20000), 'הלקוח בלובי')
        check(poll(cli, "document.querySelector('#mpSpeedSeg button.on').dataset.v==='fast'"), 'הלקוח רואה "מצב אקסטרים" שהמארח בחר')
        check(cli.evaluate("[...document.querySelectorAll('#mpSpeedSeg button')].every(b=>b.disabled)"), 'אצל הלקוח הבחירה לקריאה בלבד')
        poll(host, "document.querySelectorAll('#lobbyPlayers li').length===2")
        host.evaluate("document.activeElement && document.activeElement.blur()")
        host.screenshot(path=os.path.join(SHOTS, 'v918_lobby_host_412x915.png'))
        cli.screenshot(path=os.path.join(SHOTS, 'v918_lobby_client_412x915.png'))
        host.click('#startBtn')
        check(poll(host, "window.__kovesh.state==='play'") and poll(cli, "window.__kovesh.state==='play'"), 'הסיבוב התחיל אצל שניהם')
        check(abs(host.evaluate('window.__kovesh.game.SPEED') - FAST) < 1e-9, 'מארח: SPEED מהיר')
        check(abs(cli.evaluate('window.__kovesh.game.SPEED') - FAST) < 1e-9, 'לקוח: SPEED מהיר (הגיע ב-start)')
        check(poll(cli, "window.__kovesh.me.alive && document.getElementById('feed').textContent.includes('מצב אקסטרים')", 5000), 'לקוח: הודעת מצב אקסטרים')
        # הלקוח זז במהירות של המארח (אינטרפולציה)
        d = cli.evaluate("""() => new Promise(r => { const k = window.__kovesh, g = k.game, m = k.me; const x0 = m.x, y0 = m.y, t = performance.now();
            setTimeout(() => { r([Math.hypot(Game.wrapDelta(m.x - x0, g.W), Game.wrapDelta(m.y - y0, g.W)), (performance.now() - t) / 1000, m.alive]); }, 600); })""")
        if d[2]: check(d[0] / d[1] > 9.75 * 1.2, 'לקוח: הדמות שלו זזה ~%.1f יח\'/ש\' (מהר מ-9.75)' % (d[0] / d[1]))
        late = ctx.new_page(); late.on('pageerror', lambda e: errs.append('late: ' + str(e)))
        late.goto(url + '?transport=local&room=' + code)
        check(poll(late, "window.__kovesh.state==='play' && window.__kovesh.game", 20000), 'מצטרף באמצע נכנס למשחק')
        check(abs(late.evaluate('window.__kovesh.game.SPEED') - FAST) < 1e-9, 'מצטרף באמצע: SPEED מהיר')
        ctx.close()

        print('הודעת שגיאה כללית')
        ctx = mkctx(); pg = ctx.new_page()
        pg.goto(url + '?transport=local'); pg.wait_for_timeout(300)
        src = open(os.path.join(ROOT, 'js', 'mp.js'), encoding='utf-8').read()
        check('אותה רשת' not in src and 'Hotspot' not in src and 'נקודה חמה' not in src and 'ראוטר' not in src, 'mp.js: אין "אותה רשת" / Hotspot / ראוטר')
        html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
        check('אותה רשת' not in html and 'Hotspot' not in html, 'index.html: אין "אותה רשת" / Hotspot')
        check("לא הצלחנו להתחבר לחדר" in src, 'ERR_NET כללי: "לא הצלחנו להתחבר לחדר…"')
        ctx.close()
        b.close()
finally:
    srv.terminate()
check(not errs, 'בלי שגיאות דף ' + (json.dumps(errs, ensure_ascii=False) if errs else ''))
print('PASS' if not fails else 'FAIL: ' + json.dumps(fails, ensure_ascii=False))
sys.exit(1 if fails else 0)
