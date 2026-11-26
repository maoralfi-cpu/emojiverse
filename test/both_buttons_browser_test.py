#!/usr/bin/env python3
"""v9.28 – שני כפתורים נפרדים למלכודות ולפצצה, צילום 412×915 כשמחזיקים את שניהם."""
import sys, os, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v928_both.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8792', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, R = [], {}
ok = True

def check(cond, msg):
    global ok
    if cond:
        print('✓', msg)
    else:
        ok = False
        print('✗', msg)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8792/', wait_until='load')
        pg.wait_for_timeout(500)
        pg.click('#trapSeg button[data-v="on"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(1200)
        pg.evaluate("""() => {
          const k = window.__kovesh, me = k.me;
          me.invulnUntil = 1e9;
          me.x = me.px = me.homeX; me.y = me.py = me.homeY; me.trail.length = 0;
          k.packs.packs.length = 0; k.packs.spawnCD = 1e9; k.packs.trapLootCD = 1e9; k.packs.bombLootCD = 1e9;
          me.traps = 3; me.bomb = 1; Items.sync(me);
        }""")
        pg.wait_for_timeout(250)
        info = pg.evaluate("""() => {
          const k = window.__kovesh, me = k.me;
          const item = document.getElementById('itemBtn');
          const bomb = document.getElementById('bombBtn');
          const badge = document.getElementById('itemN');
          const ir = item.getBoundingClientRect(), br = bomb.getBoundingClientRect();
          const ids = ['minimap','stats','board','pauseBtn','packFx','feed'];
          function overlaps(a, b) {
            if (!a.width || !b.width) return false;
            return !(a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom);
          }
          const hud = {};
          ids.forEach(id => {
            const e = document.getElementById(id);
            if (!e || e.classList.contains('hidden')) { hud[id] = false; return; }
            const r = e.getBoundingClientRect();
            hud[id] = overlaps(ir, r) || overlaps(br, r);
          });
          return {
            traps: me.traps, hasBomb: me.bomb,
            itemShown: !item.classList.contains('hidden'),
            bombShown: !bomb.classList.contains('hidden'),
            badge: badge && !badge.classList.contains('hidden') ? badge.textContent : '',
            item: {x: ir.x, y: ir.y, w: ir.width, h: ir.height, right: ir.right, bottom: ir.bottom},
            bombBox: {x: br.x, y: br.y, w: br.width, h: br.height, right: br.right, bottom: br.bottom},
            overlapEachOther: overlaps(ir, br),
            hud,
            vw: window.innerWidth, vh: window.innerHeight
          };
        }""")
        R['info'] = info
        check(info['traps'] == 3 and info['hasBomb'] == 1, 'מחזיק 3 מלכודות ופצצה')
        check(info['itemShown'] and info['bombShown'], 'שני הכפתורים גלויים')
        check(info['badge'] == '3', 'מונה 3 על כפתור המלכודת')
        check(not info['overlapEachOther'], 'הכפתורים לא חופפים זה לזה')
        check(info['item']['w'] >= 70 and info['bombBox']['w'] >= 70, 'כפתורים בגודל לחיץ')
        check(info['item']['right'] <= info['bombBox']['x'] + 0.5, 'פצצה מימין למלכודת')
        check(info['item']['bottom'] <= 915 and info['bombBox']['bottom'] <= 915, 'בתוך המסך')
        check(info['item']['x'] >= 0 and info['bombBox']['right'] <= 412, 'לא חורגים לרוחב')
        check(not any(info['hud'].values()), 'לא חופפים ל-HUD: ' + str(info['hud']))
        pg.screenshot(path=SHOT, full_page=False)
        print('shot', SHOT)

        # הטלת מלכודת משאירה את כפתור הפצצה
        pg.evaluate("window.__kovesh.useItem('trap')")
        pg.wait_for_timeout(150)
        after = pg.evaluate("""() => ({
          traps: window.__kovesh.me.traps, bomb: window.__kovesh.me.bomb,
          itemShown: !document.getElementById('itemBtn').classList.contains('hidden'),
          bombShown: !document.getElementById('bombBtn').classList.contains('hidden'),
          badge: document.getElementById('itemN').textContent,
          badgeOn: !document.getElementById('itemN').classList.contains('hidden'),
          dropped: window.__kovesh.items.list.map(i => i.k)
        })""")
        check(after['traps'] == 2 and after['bomb'] == 1, 'הטלת מלכודת משאירה פצצה')
        check(after['itemShown'] and after['bombShown'], 'שני הכפתורים עדיין גלויים אחרי הטלה')
        check(after['badgeOn'] and after['badge'] == '2', 'מונה ירד ל-2')
        check(after['dropped'] == ['trap'], 'הוטלה מלכודת')

        # מקשים
        keys = pg.evaluate("""() => {
          const me = window.__kovesh.me, items = window.__kovesh.items;
          me.traps = 1; me.bomb = 1; Items.sync(me);
          items.list.length = 0;
          return true;
        }""")
        pg.keyboard.press('Space')
        pg.wait_for_timeout(80)
        afterSpace = pg.evaluate("() => ({traps: window.__kovesh.me.traps, bomb: window.__kovesh.me.bomb, ks: window.__kovesh.items.list.map(i=>i.k)})")
        check(afterSpace['traps'] == 0 and afterSpace['bomb'] == 1 and afterSpace['ks'][-1:] == ['trap'], 'רווח מטיל מלכודת')
        pg.keyboard.press('b')
        pg.wait_for_timeout(80)
        afterB = pg.evaluate("() => ({traps: window.__kovesh.me.traps, bomb: window.__kovesh.me.bomb, ks: window.__kovesh.items.list.map(i=>i.k)})")
        check(afterB['bomb'] == 0 and afterB['traps'] == 0 and afterB['ks'][-1:] == ['bomb'], 'B מטיל פצצה')
        if errors:
            print('console', errors)
            check(False, 'בלי שגיאות קונסול')
        else:
            check(True, 'בלי שגיאות קונסול')
        b.close()
finally:
    srv.terminate()
print(R)
sys.exit(0 if ok else 1)
