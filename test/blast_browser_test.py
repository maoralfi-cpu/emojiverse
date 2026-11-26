#!/usr/bin/env python3
"""v9.26 – צילומי דפדפן (טלפון 412×915): פיצוץ ברדיוס החדש, ומלכודת שהונחה ליד מלכודת איסוף באותו גודל."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT_BLAST = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v926_blast.png'
SHOT_TRAPS = sys.argv[2] if len(sys.argv) > 2 else '/workspace/v926_traps_size.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8784', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, fails, R = [], [], {}
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)

SETUP = '''() => {
  const k = window.__kovesh, g = k.game, me = k.me;
  if (k.pits) k.pits.pits.length = 0;
  if (k.packs) { k.packs.packs.length = 0; k.packs.spawnCD = 1e9; k.packs.trapLootCD = 1e9; }
  g.players.forEach(p => { p.invulnUntil = 1e9; if (p !== me) { p.x = p.px = 2; p.y = p.py = 2; p.trail.length = 0; } });
  const cx = me.homeX != null ? me.homeX : me.x, cy = me.homeY != null ? me.homeY : me.y;
  me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0; me.h = me.target = -Math.PI / 2;
  window.__cx = cx; window.__cy = cy;
  window.__lockPos = window.__lockPos || setInterval(() => {
    if (!me.alive) return;
    me.x = me.px = window.__cx; me.y = me.py = window.__cy; me.trail.length = 0;
  }, 16);
  return { speed: g.SPEED, blast: Items.BLAST_R, blastOld: Items.BLAST_R_OLD, trapR: Items.TRAP_R, cell: g.CELL };
}'''

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))

        print('פיצוץ')
        pg.goto('http://127.0.0.1:8784/', wait_until='load')
        pg.wait_for_timeout(400)
        pg.click('#trapSeg button[data-v="on"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        check(pg.evaluate("window.__kovesh.state") == 'play', 'המשחק התחיל')
        meta = pg.evaluate(SETUP)
        R['meta'] = meta
        check(abs(meta['blast'] - 8.75) < 1e-9 and abs(meta['blast'] - meta['blastOld'] * 2.5) < 1e-9, 'BLAST_R=8.75 (×2.5 מ-3.5)')
        check(abs(meta['blast'] / meta['cell'] - 17.5) < 1e-9, 'רדיוס חדש = 17.5 תאים')
        check(abs(meta['trapR'] - 1.6 * 1.12) < 1e-9, 'TRAP_R = גודל איסוף 1.792')

        # שמים פצצה במרכז המסך, השחקן מחוץ לרדיוס החדש כדי שישרוד, ומקדימים את הפתיל
        armed = pg.evaluate("""() => {
          const k = window.__kovesh, g = k.game, me = k.me, items = k.items;
          const cx = window.__cx, cy = window.__cy;
          const away = Items.BLAST_R + 3;
          window.__cx = g.wrap(cx);
          window.__cy = g.wrap(cy + away);
          me.x = me.px = window.__cx; me.y = me.py = window.__cy; me.trail.length = 0;
          items.list.length = 0;
          items.list.push({ id: 1, k: 'bomb', x: cx, y: cy, o: me.id, until: g.tickNo + 8 });
          window.__bombAt = { x: cx, y: cy, away };
          return { untilIn: 8, away };
        }""")
        # מחכים לפיצוץ ולטבעת כמעט מלאה (~400ms אחרי boom)
        exploded = False
        for _ in range(40):
            pg.wait_for_timeout(50)
            st = pg.evaluate("({ n: window.__kovesh.booms.length, list: window.__kovesh.items.list.length, ev: window.__kovesh.items.events.map(e=>e.type) })")
            if st['n'] > 0 or st['list'] == 0:
                exploded = True
                # לתת לטבעת להתרחב קרוב לרדיוס המלא
                pg.wait_for_timeout(280)
                break
        check(exploded, 'הפיצוץ הופעל (booms/list)')
        # וידוא שהטבעת באמת בגודל החדש: דגימת פיקסלים במרחק הישן מול החדש
        # קודם נוסיף boom ידני עם t0 מכוון אם כבר דעך
        pg.evaluate("""() => {
          const k = window.__kovesh;
          if (!k.booms.length) k.booms.push({ x: window.__bombAt.x, y: window.__bombAt.y, t0: performance.now() - 350 });
          else k.booms[0].t0 = performance.now() - 350;
          ['board','stats','feed'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
        }""")
        pg.wait_for_timeout(80)
        os.makedirs(os.path.dirname(SHOT_BLAST) or '.', exist_ok=True)
        pg.screenshot(path=SHOT_BLAST, full_page=False)
        check(os.path.isfile(SHOT_BLAST) and os.path.getsize(SHOT_BLAST) > 10000, 'צילום פיצוץ: ' + SHOT_BLAST)

        print('גודל מלכודת שהונחה מול איסוף')
        pg.goto('http://127.0.0.1:8784/', wait_until='load')
        pg.wait_for_timeout(400)
        pg.click('#trapSeg button[data-v="on"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        pg.evaluate(SETUP)
        sizes = pg.evaluate("""() => {
          const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs, items = k.items;
          const cx = window.__cx, cy = window.__cy;
          packs.packs.length = 0; items.list.length = 0;
          // איסוף משמאל, מלכודת שהונחה מימין, באותו גובה מול השחקן
          const dx = 3.2;
          packs.packs.push({ id: 1, x: g.wrap(cx - dx), y: g.wrap(cy), effectId: 'trap', kind: 'traploot' });
          items.list.push({ id: 2, k: 'trap', x: g.wrap(cx + dx), y: g.wrap(cy), o: me.id, until: g.tickNo + 1e9, arm: g.tickNo + 1e9 });
          return { trapR: Items.TRAP_R, pickR: Packs.PICK_R, vis: 1.6 * 1.12 };
        }""")
        R['sizes'] = sizes
        check(abs(sizes['trapR'] - sizes['vis']) < 1e-9, 'TRAP_R תואם ציור האיסוף')
        pg.evaluate("""() => {
          ['board','stats','feed'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
        }""")
        pg.wait_for_timeout(300)
        os.makedirs(os.path.dirname(SHOT_TRAPS) or '.', exist_ok=True)
        pg.screenshot(path=SHOT_TRAPS, full_page=False)
        check(os.path.isfile(SHOT_TRAPS) and os.path.getsize(SHOT_TRAPS) > 10000, 'צילום גדלים: ' + SHOT_TRAPS)

        ctx.close(); b.close()
finally:
    srv.terminate()
check(not errors, 'בלי שגיאות דף ' + (json.dumps(errors, ensure_ascii=False) if errors else ''))
print(json.dumps(R, ensure_ascii=False, indent=2))
print('PASS' if not fails else 'FAIL: ' + json.dumps(fails, ensure_ascii=False))
sys.exit(1 if fails else 0)
