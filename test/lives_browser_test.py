#!/usr/bin/env python3
"""v9.13 מצב חיים – בדיקת דפדפן: סולו (רגיל/חיים) + אונליין מקומי (מארח + לקוח, transport=local).
/home/box/factory/tools/.venv/bin/python test/lives_browser_test.py [--shots DIR]"""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8777', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
url = 'http://127.0.0.1:8777/'
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

        print('סולו – רגיל (רגרסיה)')
        pg = page('solo', {'name': 'מאור', 'v': 6, 'bots': 5, 'smode': 'normal', 'fx': 'reduced'})
        pg.goto(url, wait_until='load'); pg.wait_for_timeout(300)
        check(pg.is_visible('#soloModeSeg'), 'בתפריט יש "מצב משחק"')
        pg.click('#playBtn'); pg.wait_for_timeout(500)
        check(pg.evaluate('window.__kovesh.livesStart') == 0, 'רגיל: בלי חיים')
        check(pg.is_hidden('#myLives'), 'רגיל: אין לבבות ב-HUD')
        pg.evaluate("(()=>{const k=window.__kovesh;k.game.kill(k.me,null,'self')})()")
        check(wait(pg, "window.__kovesh.state==='over'", 3000), 'רגיל: פסילה ראשונה = סוף משחק')
        check('נפסלת' in pg.inner_text('#overTitle') or 'שיא' in pg.inner_text('#overTitle'), 'כותרת נפסלת/שיא')

        print('סולו – חיים')
        pg.click('#menuBtn'); pg.click('#soloModeSeg button[data-v="3"]')
        pg.click('#playBtn'); pg.wait_for_timeout(500)
        check(pg.evaluate('window.__kovesh.livesStart') == 3, 'חיים ×3')
        check(pg.evaluate("window.__kovesh.game.players.every(p=>p.lives===3)"), 'כולם עם 3 חיים (גם בוטים)')
        check(pg.is_visible('#myLives') and pg.inner_text('#myLives').count('❤') == 3, 'HUD: 3 לבבות')
        check(pg.is_hidden('#timer'), 'אין שעון')
        pg.evaluate("(()=>{const k=window.__kovesh;k.game.kill(k.me,null,'self')})()")
        pg.wait_for_timeout(600)
        check(pg.evaluate('window.__kovesh.state') == 'play', 'פסילה ראשונה – ממשיכים')
        check(pg.evaluate('window.__kovesh.me.lives') == 2, 'נשארו 2 חיים')
        check(pg.is_visible('#lifeMsg') and 'חוזר בעוד' in pg.inner_text('#lifeMsg'), 'הודעת "חוזר בעוד…"')
        check(wait(pg, 'window.__kovesh.me.alive', 5000), 'חזרתי לחיים אחרי ~3 שנ\'')
        prot = pg.evaluate("(()=>{const k=window.__kovesh;return {inv:k.me.invulnUntil-k.game.tickNo}})()")
        check(prot['inv'] > 0, 'הגנה פעילה אחרי חזרה: %s' % prot)
        pg.evaluate("(()=>{const k=window.__kovesh;k.game.kill(k.me,null,'self')})()")
        check(pg.evaluate('window.__kovesh.me.alive') and pg.evaluate('window.__kovesh.me.lives') == 2, 'בזמן ההגנה לא נפסלים')
        # ❤️
        pg.evaluate("(()=>{const k=window.__kovesh,g=k.game;k.packs.spawnHeart(g,{x:k.me.x,y:k.me.y})})()")
        check(wait(pg, 'window.__kovesh.me.lives===3', 2000), 'לב ❤️ – +1 חיים')
        # כל הבוטים מודחים => ניצחון
        pg.evaluate("(()=>{const k=window.__kovesh,g=k.game;g.players.forEach(p=>{if(p!==k.me){p.lives=1;p.invulnUntil=0;g.kill(p,null,'self')}})})()")
        check(wait(pg, "window.__kovesh.state==='over'", 4000), 'כולם בחוץ – מסך סיום')
        check('ניצחת' in pg.inner_text('#overTitle'), 'סולו: ניצחת! 🏆')
        shot(pg, 'lives_solo_win.png')
        # הפסד ב-0 חיים
        pg.click('#againBtn'); pg.wait_for_timeout(400)
        pg.evaluate("(()=>{const k=window.__kovesh;k.me.lives=1;k.game.kill(k.me,null,'self')})()")
        check(wait(pg, "window.__kovesh.state==='over'", 3000) and 'הודחת' in pg.inner_text('#overTitle') or 'שיא' in pg.inner_text('#overTitle'), 'סולו: 0 חיים = הודחת')
        pg.close()

        print('אונליין – לובי')
        host = page('host', {'name': 'מאור', 'v': 6, 'emoji': '🦁', 'fx': 'reduced'})
        cli = page('cli', {'name': 'נועה', 'v': 6, 'emoji': '🐼', 'fx': 'reduced'})
        host.goto(url + '?transport=local'); host.click('#onlineBtn'); host.click('#hostBtn')
        check(wait(host, "document.getElementById('roomCode').textContent.length===4 && !document.getElementById('lobby').classList.contains('hidden')"), 'חדר נפתח')
        code = host.evaluate("document.getElementById('roomCode').textContent")
        check(host.evaluate("document.querySelector('#mpModeSeg .on').dataset.v") == 'rounds', 'ברירת מחדל: סיבובים')
        check(host.is_visible('#mpTimeSeg') and host.is_hidden('#mpLivesSeg'), 'בסיבובים – שורת זמן')
        cli.goto(url + '?transport=local&room=' + code)
        check(wait(cli, "document.querySelectorAll('#lobbyPlayers li').length>=2", 15000), 'לקוח הצטרף')
        host.click('#mpModeSeg button[data-v="lives"]')
        check(host.is_hidden('#mpTimeSeg') and host.is_visible('#mpLivesSeg'), 'חיים: שורת זמן הוחלפה בשורת חיים')
        check(host.evaluate("document.querySelector('#mpLivesSeg .on').dataset.v") == '3', 'ברירת מחדל 3 חיים')
        check(wait(cli, "document.querySelector('#mpModeSeg .on').dataset.v==='lives' && !document.getElementById('mpLivesSeg').classList.contains('hidden')", 3000), 'הלקוח רואה את בחירת המארח')
        host.click('#mpBotsSeg button[data-v="2"]')
        shot(cli, 'lives_lobby_client.png')
        host.click('#startBtn')
        check(wait(cli, "window.__kovesh.state==='play' && window.__kovesh.livesStart===3", 8000), 'לקוח במשחק חיים')
        check(cli.is_hidden('#timer') and host.is_hidden('#timer'), 'אין שעון במצב חיים')
        cid = cli.evaluate('window.__kovesh.me.id')

        print('אונליין – פסילה, חזרה, הדחה, לב')
        host.evaluate("(id)=>{const g=window.__kovesh.game;g.kill(g.players[id-1],null,'self')}", cid)
        check(wait(cli, 'window.__kovesh.me.lives===2', 3000), 'לקוח: 2 חיים אחרי פסילה')
        check(wait(cli, "!document.getElementById('lifeMsg').classList.contains('hidden')", 2000) and 'חוזר' in cli.inner_text('#lifeMsg'), 'לקוח: "חוזר בעוד…"')
        check(wait(cli, 'window.__kovesh.me.alive', 6000), 'לקוח חזר לחיים')
        check(cli.evaluate('window.__kovesh.me.protMs > performance.now()'), 'לקוח: הבהוב הגנה')
        bot = host.evaluate("window.__kovesh.game.players.find(p=>p.isBot).id")
        host.evaluate("(id)=>{const g=window.__kovesh.game,p=g.players[id-1];p.lives=1;p.invulnUntil=0;g.kill(p,null,'self')}", bot)
        check(wait(cli, "document.querySelectorAll('#board li.out').length===1", 3000), 'מודח מופיע בלוח (מעומעם)')
        host.wait_for_timeout(3600)
        check(not host.evaluate("(id)=>window.__kovesh.game.players[id-1].alive", bot), 'מודח לא חוזר')
        check(cli.evaluate("(id)=>!window.__kovesh.game.players[id-1].alive", bot), 'אצל הלקוח – מודח לא חי')
        host.evaluate("""(id)=>{const k=window.__kovesh,g=k.game,p=g.players[id-1],P=k.packs,f=P.findPos;p.lives=2;
          P.packs=P.packs.filter(q=>q.kind!=='life');
          P.findPos=function(){P.findPos=f;return {x:p.x+Math.cos(p.h+1.57)*4,y:p.y+Math.sin(p.h+1.57)*4}};P.heartCD=0}""", cid)
        check(wait(cli, "window.__kovesh.packs.packs.some(p=>p.kind==='life')", 2000), 'לקוח רואה ❤️ במפה')
        cli.wait_for_timeout(300); shot(cli, 'lives_hud_client.png')
        host.evaluate("(id)=>{const k=window.__kovesh,g=k.game,p=g.players[id-1],h=k.packs.packs.find(q=>q.kind==='life');h.x=p.x;h.y=p.y}", cid)
        check(wait(cli, 'window.__kovesh.me.lives===3', 3000), 'לקוח: לב +1')

        print('אונליין – ניצחון ותוצאות')
        host.evaluate("(id)=>{const g=window.__kovesh.game;g.players.forEach(p=>{if(p.id!==id&&p.lives>0){p.lives=1;p.invulnUntil=0;if(p.alive)g.kill(p,null,'self');else{p.lives=0}}})}", cid)
        check(wait(cli, "window.__kovesh.state==='results' && !document.getElementById('results').classList.contains('hidden')", 5000), 'תוצאות אצל הלקוח')
        check('נועה' in cli.inner_text('#winnerLine'), 'שורת מנצח: ' + cli.inner_text('#winnerLine'))
        check('נועה' in cli.inner_text('#rankList li:first-child'), 'המנצחת ראשונה בדירוג')
        shot(cli, 'lives_results_client.png')
        host.click('#againRoundBtn')
        check(wait(cli, "window.__kovesh.state==='play' && window.__kovesh.game.players.every(p=>p.lives===3)", 6000), 'עוד סיבוב: חיים מלאים')
        host.evaluate("(id)=>{const g=window.__kovesh.game;g.players.forEach(p=>{if(p.id!==id){p.lives=1;p.invulnUntil=0;if(p.alive)g.kill(p,null,'self');else p.lives=0}})}", cid)
        check(wait(cli, "window.__kovesh.state==='results'", 5000), 'סיבוב 2 נגמר')
        check('2' in cli.inner_text('#roundTag') and 'מצטבר' in cli.inner_text('#rankList'), 'מצטבר נשמר: ' + cli.inner_text('#roundTag'))

        print('אונליין – רגרסיה סיבובים')
        host.click('#toLobbyBtn'); host.wait_for_timeout(300)
        host.click('#mpModeSeg button[data-v="rounds"]')
        check(host.is_visible('#mpTimeSeg') and host.is_hidden('#mpLivesSeg'), 'חזרה לסיבובים – שורת זמן')
        host.click('#startBtn')
        check(wait(cli, "window.__kovesh.state==='play' && window.__kovesh.livesStart===0", 6000), 'סיבובים: בלי חיים')
        check(cli.is_visible('#timer') and cli.is_hidden('#myLives'), 'שעון מוצג, אין לבבות')
        host.evaluate("(id)=>{const g=window.__kovesh.game;g.kill(g.players[id-1],null,'self')}", cid)
        check(wait(host, "window.__kovesh.game.players[%d].alive===false" % (cid - 1), 1000), 'נפסל')
        check(wait(host, "window.__kovesh.game.players[%d].alive" % (cid - 1), 6000), 'סיבובים: חוזר כרגיל')
        check(host.evaluate("window.__kovesh.packs.packs.every(p=>p.kind!=='life')"), 'סיבובים: אין לבבות במפה')
        b.close()
finally:
    srv.terminate()
print('errors:', errors)
print('FAILS:', fails if fails else 'none')
sys.exit(1 if fails or errors else 0)
