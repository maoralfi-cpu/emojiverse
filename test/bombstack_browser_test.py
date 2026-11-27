#!/usr/bin/env python3
"""v9.29 – ערימת פצצות, צילום 412×915 עם מונה >1 על כפתור 💣."""
import sys, os, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v929_bombs.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8793', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, ok = [], True

def check(cond, msg):
    global ok
    print(('✓' if cond else '✗'), msg)
    if not cond:
        ok = False

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8793/', wait_until='load')
        pg.wait_for_timeout(400)
        pg.click('#trapSeg button[data-v="on"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(1000)
        pg.evaluate("""() => {
          const k = window.__kovesh, me = k.me;
          me.invulnUntil = 1e9;
          me.x = me.px = me.homeX; me.y = me.py = me.homeY; me.trail.length = 0;
          k.packs.packs.length = 0; k.packs.spawnCD = 1e9; k.packs.trapLootCD = 1e9; k.packs.bombLootCD = 1e9;
          me.traps = 2; me.bomb = 3; Items.sync(me);
        }""")
        pg.wait_for_timeout(200)
        info = pg.evaluate("""() => {
          const me = window.__kovesh.me;
          const bomb = document.getElementById('bombBtn');
          const badge = document.getElementById('bombN');
          const item = document.getElementById('itemBtn');
          return {
            traps: me.traps, bombs: me.bomb,
            bombShown: !bomb.classList.contains('hidden'),
            itemShown: !item.classList.contains('hidden'),
            badge: badge && !badge.classList.contains('hidden') ? badge.textContent : '',
            itemBadge: document.getElementById('itemN').textContent,
            itemBadgeOn: !document.getElementById('itemN').classList.contains('hidden')
          };
        }""")
        check(info['traps'] == 2 and info['bombs'] == 3, 'מחזיק 2 מלכודות ו-3 פצצות')
        check(info['bombShown'] and info['itemShown'], 'שני הכפתורים גלויים')
        check(info['badge'] == '3', 'מונה 3 על כפתור הפצצה')
        check(info['itemBadgeOn'] and info['itemBadge'] == '2', 'מונה 2 על כפתור המלכודת')
        pg.screenshot(path=SHOT, full_page=False)
        print('shot', SHOT)
        pg.evaluate("window.__kovesh.useItem('bomb')")
        pg.wait_for_timeout(120)
        after = pg.evaluate("""() => ({
          bombs: window.__kovesh.me.bomb, traps: window.__kovesh.me.traps,
          badge: document.getElementById('bombN').textContent,
          badgeOn: !document.getElementById('bombN').classList.contains('hidden'),
          dropped: window.__kovesh.items.list.map(i => i.k)
        })""")
        check(after['bombs'] == 2 and after['traps'] == 2, 'הטלת פצצה מורידה אחת ומשאירה מלכודות')
        check(after['badgeOn'] and after['badge'] == '2', 'מונה ירד ל-2')
        check(after['dropped'] == ['bomb'], 'הוטלה פצצה')
        check(not errors, 'בלי שגיאות קונסול' + ((' ' + str(errors)) if errors else ''))
        b.close()
finally:
    srv.terminate()
sys.exit(0 if ok else 1)
