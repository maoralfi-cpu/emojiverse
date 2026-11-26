#!/usr/bin/env python3
"""v9.27 – פצצות איסוף על הרצפה. צילום 412×915: 💣 לצד 🎁 ו-🪤."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v927_bombs.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8786', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, fails, R = [], [], {}
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8786/', wait_until='load')
        pg.wait_for_timeout(400)
        pg.click('#trapSeg button[data-v="on"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        check(pg.evaluate("window.__kovesh.state") == 'play', 'המשחק התחיל')
        info = pg.evaluate("""() => {
          const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
          if (k.pits) k.pits.pits.length = 0;
          packs.packs.length = 0; packs.spawnCD = 1e9; packs.trapLootCD = 1e9; packs.bombLootCD = 1e9;
          g.players.forEach(p => { p.invulnUntil = 1e9; if (p !== me) { p.x = p.px = 2; p.y = p.py = 2; p.trail.length = 0; } });
          const cx = me.homeX != null ? me.homeX : me.x, cy = me.homeY != null ? me.homeY : me.y;
          // השחקן מעל השורות, כדי לא לאסוף בטעות ולכסות פריט
          const px = cx, py = g.wrap(cy - 5.6);
          me.x = me.px = px; me.y = me.py = py; me.trail.length = 0; me.h = me.target = -Math.PI / 2;
          window.__lockPos = setInterval(() => { if (me.alive) { me.x = me.px = px; me.y = me.py = py; me.trail.length = 0; } }, 16);
          let n = 0;
          // שורה עליונה: קופסאות, אמצע: מלכודות, תחתונה: פצצות
          ['speed','ice','radar'].forEach((id, i) => {
            packs.packs.push({ id: ++n, x: g.wrap(cx + (i - 1) * 3.6), y: g.wrap(cy - 2.2), effectId: id });
          });
          for (let i = 0; i < 3; i++) {
            packs.packs.push({ id: ++n, x: g.wrap(cx + (i - 1) * 3.6), y: g.wrap(cy + 1.8), effectId: 'trap', kind: 'traploot' });
          }
          for (let i = 0; i < 3; i++) {
            packs.packs.push({ id: ++n, x: g.wrap(cx + (i - 1) * 3.6), y: g.wrap(cy + 5.8), effectId: 'bomb', kind: 'bombloot' });
          }
          packs.nextId = n + 1;
          // וידוא ציור: 💣 לא 🎁
          const c = document.createElement('canvas'); c.width = 90; c.height = 90;
          const x = c.getContext('2d');
          Packs.draw(x, 45, 45, 24, 0, { kind: 'bombloot', effectId: 'bomb' }, { reveal: false });
          return {
            itemsOn: !!k.itemsOn,
            gifts: packs.regularCount(),
            traps: packs.trapLootCount(),
            bombs: packs.bombLootCount(),
            look: Packs.lookOf({ kind: 'bombloot', effectId: 'bomb' }),
            emoji: Packs.emojiOf({ kind: 'bombloot', effectId: 'bomb' })
          };
        }""")
        R['info'] = info
        check(info['itemsOn'] is True, 'מצב מלכודת פעיל')
        check(info['gifts'] == 3 and info['traps'] == 3 and info['bombs'] == 3, '3 קופסאות, 3 מלכודות, 3 פצצות')
        check(info['look'] == 'mine' and info['emoji'] == '💣', 'מראה פצצת איסוף: mine + 💣')
        # seed API
        seed = pg.evaluate("""() => {
          const k = window.__kovesh, g = new Game({ size: 100 }), packs = new Packs();
          g.addPlayer({}); g.spawn(g.players[0], { x: 8, y: 8 });
          packs.reset(); packs.setItems(true);
          const b = packs.seedBombLoots(g), t = packs.seedTrapLoots(g);
          packs.reset();
          const off = packs.seedBombLoots(g);
          return { seeded: b, traps: t, max: Packs.maxFor(100), off };
        }""")
        R['seed'] = seed
        check(seed['seeded'] == seed['max'] == 2, 'seedBombLoots: 2 במפה 100')
        check(seed['off'] == 0, 'בלי מצב מלכודת אין פצצות איסוף')
        pg.evaluate("""() => {
          ['board','stats','feed','minimap'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
        }""")
        pg.wait_for_timeout(300)
        os.makedirs(os.path.dirname(SHOT) or '.', exist_ok=True)
        pg.screenshot(path=SHOT, full_page=False)
        check(os.path.isfile(SHOT) and os.path.getsize(SHOT) > 10000, 'צילום: ' + SHOT)
        ctx.close(); b.close()
finally:
    srv.terminate()
check(not errors, 'בלי שגיאות דף ' + (json.dumps(errors, ensure_ascii=False) if errors else ''))
print(json.dumps(R, ensure_ascii=False, indent=2))
print('PASS' if not fails else 'FAIL: ' + json.dumps(fails, ensure_ascii=False))
sys.exit(1 if fails else 0)
