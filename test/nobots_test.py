# בדיקה: משחק "בלי בוטים" (שחקן יחיד) – כיבוש, סיום משחק, בלי שגיאות. הרצה: tools/.venv/bin/python test/nobots_test.py
import subprocess,time
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8768'],cwd=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',headless=True); pg=b.new_context(viewport={'width':412,'height':915},is_mobile=True,has_touch=True).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.goto('http://127.0.0.1:8768/'); pg.click('#settingsBtn'); pg.click('#botsSeg button[data-v="0"]'); pg.click('#settingsBack'); pg.click('#playBtn')
    # Movement-only fixture: hazards have their own dedicated tests.
    pg.evaluate('window.__kovesh.pits.reset()')
    for k,ms in [('ArrowRight',900),('ArrowDown',900),('ArrowLeft',900),('ArrowUp',1300)]:
        pg.keyboard.down(k); pg.wait_for_timeout(ms); pg.keyboard.up(k)
    pg.wait_for_timeout(1000)
    print(pg.evaluate("(()=>{const k=window.__kovesh,g=k.game;return {state:k.state,players:g.players.length,pct:+g.pct(k.me).toFixed(2),tick:g.tickNo}})()"))
    pg.screenshot(path='/home/box/factory/code/territory-game/test/nobots.png')
    # v7 (טורוס): נסיעה שמאלה 12 שניות – אין קיר, השחקן עוטף את המפה וחוזר לשטח שלו בלי למות
    # קודם חוזרים לבית (אחרת השחקן כבר בחוץ, ושורה ישרה שעוטפת את המפה פוגשת את השובל של עצמו – מוות נכון)
    pg.evaluate("""() => new Promise(r => { const k = window.__kovesh, g = k.game, me = k.me; let n = 0;
        const t = setInterval(() => { me.target = Math.atan2(g.wd(me.homeY - me.y), g.wd(me.homeX - me.x));
          if ((!me.trail.length && g.dist2(me.x, me.y, me.homeX, me.homeY) < 1) || ++n > 200) { clearInterval(t); r(); } }, 20); })""")
    pct0 = pg.evaluate("window.__kovesh.game.pct(window.__kovesh.me)")
    pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(12000); pg.keyboard.up('ArrowLeft')
    st = pg.evaluate("(()=>{const k=window.__kovesh;return {state:k.state,alive:k.me.alive,pct:+k.game.pct(k.me).toFixed(2)}})()")
    print('after wrap', st, 'pct before', round(pct0, 2), pg.evaluate("document.getElementById('overReason').textContent"))
    assert st['state'] == 'play' and st['alive'], 'died crossing the seam'
    # סיום: נגיעה בשובל של עצמי – ריבוע קטן שנסגר על עצמו מחוץ לשטח
    pg.evaluate("window.__kovesh.game.kill(window.__kovesh.me, null, 'self')"); pg.wait_for_timeout(1500)
    print(pg.evaluate("window.__kovesh.state"), pg.evaluate("document.getElementById('over').innerText.slice(0,80)"))
    assert pg.evaluate("window.__kovesh.state") == 'over'
    print('errors',errs); b.close()
    assert not errs
    print('PASS')
srv.kill()
