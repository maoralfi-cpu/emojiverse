#!/usr/bin/env python3
"""v9.20 שליט היקום (100%) – בדיקת דפדפן: סולו (אני/בוט/חיים) + אונליין מקומי (סיבובים וחיים, מארח + לקוח).
/home/box/factory/tools/.venv/bin/python test/ruler_browser_test.py [--shots DIR]"""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8778', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
url = 'http://127.0.0.1:8778/'
errors, fails = [], []
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
def wait(pg, js, ms=10000):
    t0 = time.time()
    while True:
        try:
            if pg.evaluate('()=>{try{return !!(' + js + ')}catch(e){return false}}'): return True
        except Exception: pass
        if (time.time() - t0) * 1000 > ms: return False
        pg.wait_for_timeout(80)
def shot(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
# כל המפה לשחקן id (בלי שובל), מיד
FILL = "(id)=>{const g=window.__kovesh.game,p=g.players[id-1];p.trail=[];for(let i=0;i<g.owner.length;i++)g.setOwner(i,id)}"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 393, 'height': 873}, device_scale_factor=2, is_mobile=True, has_touch=True)
        def page(name, settings):
            pg = ctx.new_page()
            pg.add_init_script("if(!sessionStorage.getItem('n')){sessionStorage.setItem('n','1');localStorage.setItem('kovesh.settings', JSON.stringify(%s))}" % json.dumps(settings))
            pg.on('pageerror', lambda e: errors.append(name + ': ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errors.append(name + ': ' + m.text))
            return pg

        print('סולו – אני שליט היקום')
        pg = page('solo', {'name': 'מאור', 'v': 6, 'bots': 5, 'smode': 'normal', 'fx': 'reduced', 'emoji': '🦁'})
        pg.goto(url, wait_until='load'); pg.wait_for_timeout(300)
        pg.click('#playBtn'); pg.wait_for_timeout(600)
        pg.evaluate(FILL, 1)
        check(wait(pg, "window.__kovesh.state==='over'", 4000), 'המשחק נגמר מיד')
        check('שליט היקום' in pg.inner_text('#overTitle'), 'כותרת: ' + pg.inner_text('#overTitle'))
        check(pg.evaluate("document.getElementById('overCard').classList.contains('ruler')"), 'כרטיס מיוחד')
        check(pg.evaluate("window.__kovesh.game.rulerId===1"), 'rulerId נקבע (חזרות לחיים נעצרות)')
        pg.wait_for_timeout(700); shot(pg, 'v920_ruler.png')

        print('סולו – בוט שליט היקום')
        pg.click('#menuBtn'); pg.click('#playBtn'); pg.wait_for_timeout(600)
        check(not pg.evaluate("document.getElementById('overCard').classList.contains('ruler')") or pg.evaluate("window.__kovesh.state==='play'"), 'משחק חדש התחיל')
        pg.evaluate(FILL, 2)
        check(wait(pg, "window.__kovesh.state==='over'", 4000), 'נגמר (בוט כבש הכול)')
        nm2 = pg.evaluate("window.__kovesh.game.players[1].name")
        check('שליט היקום' in pg.inner_text('#overTitle') and nm2 in pg.inner_text('#overTitle'), 'כותרת: ' + pg.inner_text('#overTitle'))
        shot(pg, 'v920_ruler_bot.png')

        print('סולו – חיים')
        pg.click('#menuBtn'); pg.click('#soloModeSeg button[data-v="3"]'); pg.click('#playBtn'); pg.wait_for_timeout(600)
        check(pg.evaluate('window.__kovesh.livesStart') == 3, 'חיים ×3')
        pg.evaluate(FILL, 1)
        check(wait(pg, "window.__kovesh.state==='over'", 4000), 'חיים: נגמר מיד')
        check('שליט היקום' in pg.inner_text('#overTitle'), 'חיים: כותרת שליט')
        check(pg.evaluate("window.__kovesh.livesEnd && window.__kovesh.livesEnd.winners[0]===1"), 'חיים: המנצח = השליט')
        pg.click('#menuBtn'); pg.click('#soloModeSeg button[data-v="normal"]')

        print('אונליין – סיבובים')
        host = page('host', {'name': 'מאור', 'v': 6, 'emoji': '🦁', 'fx': 'reduced'})
        cli = page('cli', {'name': 'נועה', 'v': 6, 'emoji': '🐼', 'fx': 'reduced'})
        host.goto(url + '?transport=local'); host.click('#onlineBtn'); host.click('#hostBtn')
        check(wait(host, "document.getElementById('roomCode').textContent.length===4 && !document.getElementById('lobby').classList.contains('hidden')"), 'חדר נפתח')
        code = host.evaluate("document.getElementById('roomCode').textContent")
        cli.goto(url + '?transport=local&room=' + code)
        check(wait(cli, "document.querySelectorAll('#lobbyPlayers li').length>=2", 15000), 'לקוח הצטרף')
        host.click('#mpBotsSeg button[data-v="2"]')
        host.click('#startBtn')
        check(wait(cli, "window.__kovesh.state==='play'", 8000), 'לקוח במשחק')
        cid = cli.evaluate('window.__kovesh.me.id')
        host.wait_for_timeout(500)
        host.evaluate(FILL, cid)
        check(wait(cli, "window.__kovesh.state==='results' && !document.getElementById('results').classList.contains('hidden')", 5000), 'תוצאות אצל הלקוח מיד')
        wl = cli.inner_text('#winnerLine') if cli.is_visible('#winnerLine') else ''
        check('שליט היקום' in wl and 'נועה' in wl, 'לקוח: ' + wl)
        check(host.is_visible('#winnerLine') and 'שליט היקום' in host.inner_text('#winnerLine'), 'מארח: הכרזה')
        check('נועה' in cli.inner_text('#rankList li:first-child'), 'השליטה ראשונה בדירוג')
        shot(cli, 'v920_ruler_results_client.png')
        host.click('#againRoundBtn')
        check(wait(cli, "window.__kovesh.state==='play'", 6000), 'עוד סיבוב התחיל')
        host.wait_for_timeout(800)
        check(host.evaluate("!window.__kovesh.game.rulerId && window.__kovesh.state==='play'"), 'סיבוב 2: אין שליט, משחק רגיל')
        host.evaluate(FILL, 1)
        check(wait(cli, "window.__kovesh.state==='results'", 5000), 'סיבוב 2: מארח שליט – נגמר')
        check('2' in cli.inner_text('#roundTag'), 'מצטבר: ' + cli.inner_text('#roundTag'))
        check('מאור' in cli.inner_text('#winnerLine'), 'הכרזה על המארח: ' + cli.inner_text('#winnerLine'))

        print('אונליין – חיים')
        host.click('#toLobbyBtn'); host.wait_for_timeout(300)
        host.click('#mpModeSeg button[data-v="lives"]')
        host.click('#startBtn')
        check(wait(cli, "window.__kovesh.state==='play' && window.__kovesh.livesStart===3", 8000), 'לקוח במשחק חיים')
        host.wait_for_timeout(500)
        host.evaluate(FILL, cid)
        check(wait(cli, "window.__kovesh.state==='results'", 5000), 'חיים: נגמר מיד')
        check('שליט היקום' in cli.inner_text('#winnerLine'), 'חיים: ' + cli.inner_text('#winnerLine'))
        check(cli.evaluate("document.querySelector('#rankList li.win') && document.querySelector('#rankList li.win').textContent.includes('נועה')"), 'חיים: השורה של השליטה מסומנת')
        b.close()
finally:
    srv.terminate()
print('errors:', errors)
print('FAILS:', fails if fails else 'none')
sys.exit(1 if fails or errors else 0)
