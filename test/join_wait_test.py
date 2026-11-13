#!/usr/bin/env python3
"""v9.16 – הצטרפות כשהמארח בוואטסאפ: מול שרת התיאום האמיתי של PeerJS (WebRTC אמיתי, שני דפדפנים נפרדים).
א. המארח "יוצא" (מנותק מהשרת) ל-30 שנ', המצטרף פותח את הקישור בינתיים => ממשיך לחפש ומתחבר לבד כשהמארח חוזר.
ב. הצטרפות רגילה בהקלדת קוד.
ג. קוד שלא קיים => הודעת "מחפשים/מחכים", ו"חזרה" מבטל את החיפוש (לא נכנס ללובי אחר כך).
/home/box/factory/tools/.venv/bin/python test/join_wait_test.py [URL]"""
import sys, os, time, subprocess, random
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8779', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8779/'
fails, errs = [], []
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
def poll(pg, js, ms):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        try:
            if pg.evaluate('()=>{try{return !!(' + js + ')}catch(e){return false}}'): return True
        except Exception: pass
        pg.wait_for_timeout(200)
    return False
LOBBY = "!document.getElementById('lobby').classList.contains('hidden')"
try:
    with sync_playwright() as p:
        bh = p.chromium.launch(channel='chrome', headless=True); bc = p.chromium.launch(channel='chrome', headless=True)
        def page(b, name):
            ctx = b.new_context(viewport={'width': 412, 'height': 915}, is_mobile=True, has_touch=True); pg = ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(name + ': ' + str(e)))
            return ctx, pg
        print('א. המארח בוואטסאפ 30 שנ\', המצטרף פותח את הקישור')
        hctx, host = page(bh, 'host'); cctx, cli = page(bc, 'cli')
        host.goto(url); host.click('#onlineBtn'); host.click('#hostBtn')
        check(poll(host, "document.getElementById('roomCode').textContent.length===4 && " + LOBBY, 30000), 'חדר נפתח בשרת האמיתי')
        code = host.evaluate("document.getElementById('roomCode').textContent")
        hctx.set_offline(True); host.evaluate("window.__koveshNet._drop()"); t0 = time.time()
        cli.goto(url + '?room=' + code)
        check(poll(cli, "document.getElementById('onlineMsg').textContent.includes('מחכים לחדר')", 25000), 'אחרי 15 שנ\': "מחכים לחדר… שיחזור למשחק" (ולא "לא נמצא")')
        while time.time() - t0 < 30: cli.wait_for_timeout(500)
        check(not cli.evaluate(LOBBY) and cli.evaluate("document.getElementById('retryBtn').classList.contains('hidden')"), 'עדיין מחפש אחרי 30 שנ\', בלי כפתור "נסו שוב"')
        hctx.set_offline(False); host.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online'))")
        check(poll(cli, LOBBY, 45000), 'המארח חזר => המצטרף נכנס ללובי לבד (%.0f שנ\' מההתחלה)' % (time.time() - t0))
        check(poll(host, "document.querySelectorAll('#lobbyPlayers li').length===2", 8000), 'המארח רואה 2 שחקנים')
        if fails: print('   diag host:', host.evaluate("JSON.stringify(window.__evNet)"), host.evaluate("document.getElementById('lobbyMsg').textContent"), '| cli:', cli.evaluate("JSON.stringify(window.__evNet)"), cli.evaluate("document.getElementById('onlineMsg').textContent"))
        hctx.close(); cctx.close()

        print('ב. הצטרפות בהקלדת קוד')
        hctx, host = page(bh, 'host2'); cctx, cli = page(bc, 'cli2')
        host.goto(url); host.click('#onlineBtn'); host.click('#hostBtn')
        poll(host, "document.getElementById('roomCode').textContent.length===4 && " + LOBBY, 30000)
        code = host.evaluate("document.getElementById('roomCode').textContent")
        cli.goto(url); cli.click('#onlineBtn'); cli.fill('#codeInput', code); cli.click('#joinBtn')
        check(poll(cli, LOBBY, 30000) and poll(host, "document.querySelectorAll('#lobbyPlayers li').length===2", 8000), 'הצטרף בקוד ' + code)
        hctx.close(); cctx.close()

        print('ג. קוד שלא קיים, ו"חזרה" מבטל')
        cctx, cli = page(bc, 'cli3')
        bad = '%04d' % random.randint(0, 9999)
        cli.goto(url); cli.click('#onlineBtn'); cli.fill('#codeInput', bad); cli.click('#joinBtn')
        check(poll(cli, "/מחפשים|מחכים/.test(document.getElementById('onlineMsg').textContent)", 15000), 'הודעת חיפוש לקוד ' + bad)
        cli.click('#onlineBack')
        check(cli.evaluate("window.__koveshNet.role") is None, '"חזרה" מבטל את החיפוש')
        cli.wait_for_timeout(5000)
        check(cli.evaluate("window.__koveshNet.role") is None and not cli.evaluate(LOBBY), 'לא ממשיך לחפש אחרי "חזרה"')
        cctx.close()
        bh.close(); bc.close()
finally:
    if srv: srv.terminate()
print('errors:', errs)
print('FAILS:', fails if fails else 'none')
sys.exit(1 if fails or errs else 0)
