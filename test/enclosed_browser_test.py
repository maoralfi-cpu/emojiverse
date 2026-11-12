#!/usr/bin/env python3
"""v9.14/v9.15 נכלא/ה – בדיקת דפדפן אונליין מקומי (מארח + לקוח, transport=local).
המארח סוגר לולאה סביב הלקוח שעומד על רצועה של השטח של המארח (תא שכבר היה של הכובש) –
הלקוח חייב לראות שנפסל (enclosed), הודעת «נכלא/ה», ושלא נשאר "רוח" חיה על השטח שמולא.
גם במצב חיים, כשהלקוח מוגן אחרי חזרה.
/home/box/factory/tools/.venv/bin/python test/enclosed_browser_test.py [--shots DIR]"""
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
        pg.wait_for_timeout(60)
def shot(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))

# בונה את המצב אצל המארח: בסיס + רצועה של המארח, הלקוח על קצה הרצועה, שובל סגור סביבו. protect = הלקוח מוגן.
SETUP = """([cid, protect]) => { const k = window.__kovesh, g = k.game, a = k.me, b = g.players[cid - 1];
  for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === a.id || g.owner[i] === b.id) g.setOwner(i, 0);
  const R = (id, x0, y0, x1, y1) => { for (let y = y0; y < y1; y += g.CELL) for (let x = x0; x < x1; x += g.CELL) g.setOwner(g.cellAt(x + .01, y + .01), id); };
  R(a.id, 16, 16, 24, 24); R(a.id, 18, 21, 22, 26); R(a.id, 20, 24.5, 34, 26); R(b.id, 60, 60, 66, 66);
  g._lost.fill(0);
  b.x = b.px = 32; b.y = b.py = 25.2; b.h = b.target = Math.PI; b.trail = [33.5, 25.2, 32, 25.2]; b.tb = [32, 25.2, 33.5, 25.2];
  b.invulnUntil = protect ? g.tickNo + 90 : 0;
  a.x = a.px = 21; a.y = a.py = 20; a.trail = []; a.h = a.target = Math.PI;
  // מצמידים את שניהם עד הסגירה (לצילום "לפני"). speedMul=0 לא עוצר: step משתמש ב-(speedMul || 1)
  clearInterval(window.__pin); window.__pin = setInterval(() => { if (b.alive) { b.x = b.px = 32; b.y = b.py = 25.2; b.trail = [33.5, 25.2, 32, 25.2]; b.tb = [32, 25.2, 33.5, 25.2]; } a.x = a.px = 21; a.y = a.py = 20; a.trail = []; }, 4);
  return true; }"""
CLOSE = """([cid]) => { const k = window.__kovesh, g = k.game, a = k.me, b = g.players[cid - 1]; clearInterval(window.__pin);
  b.x = b.px = 32; b.y = b.py = 25.2; b.trail = [33.5, 25.2, 32, 25.2]; b.tb = [32, 25.2, 33.5, 25.2];
  const t = [], add = (x, y) => t.push(x, y);
  for (let x = 23.9; x <= 38; x += 0.16) add(x, 20); for (let y = 20; y <= 30; y += 0.16) add(38, y);
  for (let x = 38; x >= 20; x -= 0.16) add(x, 30); for (let y = 30; y >= 25.9; y -= 0.16) add(20, y);
  a.trail = t; a.tb = [20, 20, 38, 30]; a.x = a.px = 20; a.y = a.py = 25.9; a.h = a.target = -Math.PI / 2;
  const pre = g.ownerAt(32, 25.2);
  b.invulnUntil = b.invulnUntil ? g.tickNo + 60 : 0;   // עדיין מוגן ברגע הסגירה
  g.capture(a);
  return { pre: pre, alive: b.alive, kills: a.kills, own: g.ownerAt(32, 25.2) === a.id && g.ownerAt(30, 28) === a.id }; }"""
# v9.15: פלישה עם שובל פתוח אמיתי – מהשטח של הלקוח (מימין) עמוק לתוך הבלוק של המארח. המארח מקיף את הרווח ואת שורש השובל בלי לגעת בו.
INV_SETUP = """([cid, protect]) => { const k = window.__kovesh, g = k.game, a = k.me, b = g.players[cid - 1];
  for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === a.id || g.owner[i] === b.id) g.setOwner(i, 0);
  const R = (id, x0, y0, x1, y1) => { for (let y = y0; y < y1; y += g.CELL) for (let x = x0; x < x1; x += g.CELL) g.setOwner(g.cellAt(x + .01, y + .01), id); };
  R(a.id, 10, 10, 40, 40); R(b.id, 50, 18, 62, 32); g._lost.fill(0);
  const T = []; for (let x = 50.2; x >= 32; x -= 0.16) T.push(x, 25);
  const pin = () => { if (b.alive) { b.x = b.px = 32; b.y = b.py = 25; b.h = b.target = Math.PI; b.trail = T.slice(); b.tb = [32, 25, 50.2, 25]; b.anchor = g.cellAt(50.6, 25); } a.x = a.px = 36; a.y = a.py = 15; a.trail = []; };
  pin(); b.invulnUntil = protect ? g.tickNo + 90 : 0;
  clearInterval(window.__pin); window.__pin = setInterval(pin, 4);
  return { root: g.ownerAt(T[0], T[1]) === b.id, head: g.ownerAt(32, 25) === a.id }; }"""
INV_CLOSE = """([cid]) => { const k = window.__kovesh, g = k.game, a = k.me, b = g.players[cid - 1]; clearInterval(window.__pin);
  const t = [], add = (x, y) => t.push(x, y);
  for (let x = 39.8; x <= 55; x += 0.16) add(x, 15); for (let y = 15; y <= 35; y += 0.16) add(55, y);
  for (let x = 55; x >= 39.4; x -= 0.16) add(x, 35);
  a.trail = t; a.tb = [39.4, 15, 55, 35]; a.x = a.px = 39.4; a.y = a.py = 35; a.h = a.target = Math.PI;
  const preHead = g.ownerAt(b.x, b.y), crossed = g.trailDist2(b, 55, 25, 0, true) < 1;
  if (b.invulnUntil) b.invulnUntil = g.tickNo + 60;   // עדיין מוגן ברגע הסגירה
  g.capture(a);
  return { preHead: preHead, crossed: crossed, alive: b.alive, kills: a.kills, own: g.ownerAt(45, 25) === a.id && g.ownerAt(32, 25) === a.id, btrail: b.trail.length }; }"""
try:
    with sync_playwright() as p:
        br = p.chromium.launch(channel='chrome', headless=True)
        ctx = br.new_context(viewport={'width': 393, 'height': 873}, device_scale_factor=2, is_mobile=True, has_touch=True)
        def page(name, settings):
            pg = ctx.new_page()
            pg.add_init_script("if(!sessionStorage.getItem('n')){sessionStorage.setItem('n','1');localStorage.setItem('kovesh.settings', JSON.stringify(%s))}" % json.dumps(settings))
            pg.on('pageerror', lambda e: errors.append(name + ': ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errors.append(name + ': ' + m.text))
            return pg
        for mode, scene in (('rounds', 'strip'), ('lives', 'strip'), ('rounds', 'invade'), ('lives', 'invade')):
            host = page('host', {'name': 'מאור', 'v': 6, 'emoji': '🦁'})
            cli = page('cli', {'name': 'נועה', 'v': 6, 'emoji': '🐼'})
            host.goto(url + '?transport=local'); host.click('#onlineBtn'); host.click('#hostBtn')
            check(wait(host, "document.getElementById('roomCode').textContent.length===4"), 'חדר נפתח')
            code = host.evaluate("document.getElementById('roomCode').textContent")
            cli.goto(url + '?transport=local&room=' + code)
            check(wait(cli, "document.querySelectorAll('#lobbyPlayers li').length>=2", 15000), 'לקוח הצטרף')
            host.click('#mpBotsSeg button[data-v="0"]')
            print('אונליין – ' + ('סיבובים (ברירת מחדל)' if mode == 'rounds' else 'מצב חיים, הלקוח מוגן אחרי חזרה') + ' – ' + ('על רצועה של המארח (v9.14)' if scene == 'strip' else 'פלישה עם שובל פתוח (v9.15)'))
            host.click('#mpModeSeg button[data-v="%s"]' % mode)
            host.click('#startBtn')
            check(wait(cli, "window.__kovesh.state==='play' && window.__kovesh.me && window.__kovesh.me.alive", 8000), 'לקוח במשחק')
            cid = cli.evaluate('window.__kovesh.me.id')
            if mode == 'lives':
                host.evaluate("(id)=>{const g=window.__kovesh.game;g.kill(g.players[id-1],null,'self')}", cid)
                check(wait(cli, 'window.__kovesh.me.alive && window.__kovesh.me.lives===2', 8000), 'לקוח חזר אחרי פסילה (2 חיים)')
            tag = mode + ('' if scene == 'strip' else '_invade')
            if scene == 'strip':
                host.evaluate(SETUP, [cid, mode == 'lives'])
                check(wait(cli, "(()=>{const k=window.__kovesh,m=k.me;return m.alive&&Math.abs(m.x-32)<2.5&&Math.abs(m.y-25.2)<2.5})()", 3000), 'לקוח רואה את עצמו על הרצועה של המארח')
            else:
                s0 = host.evaluate(INV_SETUP, [cid, mode == 'lives'])
                check(s0['root'] and s0['head'], 'השובל מתחיל בשטח של הלקוח והראש עמוק בשטח של המארח (%s)' % s0)
                check(wait(cli, "(()=>{const k=window.__kovesh,m=k.me;return m.alive&&Math.abs(m.x-32)<2.5&&Math.abs(m.y-25)<2.5&&m.trail.length>20})()", 3000), 'לקוח רואה את עצמו בתוך השטח של המארח עם שובל פתוח')
            if mode == 'lives':
                check(host.evaluate("(id)=>{const g=window.__kovesh.game,b=g.players[id-1];return b.invulnUntil>g.tickNo}", cid), 'הלקוח מוגן (הגנה אחרי חזרה)')
            cli.wait_for_timeout(250); shot(cli, 'enclosed_%s_before.png' % tag)
            if scene == 'strip':
                r = host.evaluate(CLOSE, [cid])
                check(r['pre'] == host.evaluate('window.__kovesh.me.id'), 'הראש עמד על תא שכבר היה של הכובש')
            else:
                r = host.evaluate(INV_CLOSE, [cid])
                check(not r['crossed'], 'השובל של המארח לא נגע בשובל של הלקוח')
            check(not r['alive'] and r['own'], 'מארח: הלקוח נכלא ונפסל, השטח מולא (%s)' % r)
            check(wait(cli, '!window.__kovesh.me.alive', 2000), 'לקוח: נפסל')
            check(wait(cli, "document.getElementById('feed').textContent.includes('נכלא')", 2000), 'לקוח: הודעה «נכלא/ה בשטח של…»: ' + cli.inner_text('#feed').replace('\n', ' | '))
            cli.wait_for_timeout(450); shot(cli, 'enclosed_%s_after.png' % tag)
            ghost = cli.evaluate("(id)=>{const k=window.__kovesh,g=k.game,b=g.players[id-1];return {alive:b.alive, trail:b.trail.length, cell:g.ownerAt(30,28)}}", cid)
            check(not ghost['alive'] and ghost['cell'] == host.evaluate('window.__kovesh.me.id'), 'לקוח: אין רוח חיה (ולא שובל מנותק) על השטח שמולא, השטח של המארח (%s)' % ghost)
            if mode == 'lives':
                check(wait(cli, 'window.__kovesh.me.lives===1', 2000), 'מצב חיים: הכליאה עלתה חיים (נשאר 1)')
                check(wait(cli, 'window.__kovesh.me.alive', 6000), 'מצב חיים: חוזר לחיים כרגיל')
                pos = host.evaluate("(id)=>{const g=window.__kovesh.game,b=g.players[id-1];return {o:g.ownerAt(b.x,b.y),d:Math.sqrt(g.dist2(b.x,b.y,30,26))}}", cid)
                check(pos['o'] != host.evaluate('window.__kovesh.me.id') and pos['d'] > 6, 'חזרה לא על השטח הכולא (%s)' % pos)
            else:
                check(wait(host, "window.__kovesh.game.players[%d].alive" % (cid - 1), 6000), 'סיבובים: חוזר כרגיל אחרי ההשהיה')
            host.close(); cli.close()
        br.close()
finally:
    srv.terminate()
print('errors:', errors)
print('FAILS:', fails if fails else 'none')
sys.exit(1 if fails or errors else 0)
