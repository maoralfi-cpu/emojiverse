# בדיקה: משחק "בלי בוטים" (שחקן יחיד) – כיבוש, סיום משחק, בלי שגיאות. הרצה: tools/.venv/bin/python test/nobots_test.py
import subprocess,time
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8768'],cwd=__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',headless=True); pg=b.new_context(viewport={'width':412,'height':915},is_mobile=True,has_touch=True).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.goto('http://127.0.0.1:8768/'); pg.click('#settingsBtn'); pg.click('#botsSeg button[data-v="0"]'); pg.click('#settingsBack'); pg.click('#playBtn')
    for k,ms in [('ArrowRight',900),('ArrowDown',900),('ArrowLeft',900),('ArrowUp',1300)]:
        pg.keyboard.down(k); pg.wait_for_timeout(ms); pg.keyboard.up(k)
    pg.wait_for_timeout(1000)
    print(pg.evaluate("(()=>{const k=window.__kovesh,g=k.game;return {state:k.state,players:g.players.length,pct:+g.pct(k.me).toFixed(2),tick:g.tickNo}})()"))
    pg.screenshot(path='/home/box/factory/code/territory-game/test/nobots.png')
    pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(9000); pg.keyboard.up('ArrowLeft')
    print(pg.evaluate("window.__kovesh.state"), pg.evaluate("document.getElementById('over').innerText.slice(0,80)"))
    print('errors',errs); b.close()
srv.kill()
