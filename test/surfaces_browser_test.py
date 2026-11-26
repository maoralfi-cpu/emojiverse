#!/usr/bin/env python3
"""v9.25 – הפתעות חוזרות ל-🎁 גם במצב אקסטרים; מלכודות איסוף נשארות גלויות.
בדיקת דפדפן (טלפון 412×915). צילומים: תפריט, משחק אקסטרים עם קופסאות, מלכודות גלויות."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT_EXTREME = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v925_gifts.png'
SHOT_MENU = sys.argv[2] if len(sys.argv) > 2 else '/workspace/v925_menu.png'
SHOT_TRAPS = sys.argv[3] if len(sys.argv) > 3 else '/workspace/v925_traps.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8782', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, fails, R = [], [], {}
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)

PLACE_GIFTS = '''() => {
  const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
  packs.packs.length = 0; packs.spawnCD = 1e9;
  if (k.pits) k.pits.pits.length = 0;
  g.players.forEach(p => { p.invulnUntil = 1e9; if (p !== me) { p.x = p.px = 2; p.y = p.py = 2; p.trail.length = 0; } });
  const cx = me.homeX != null ? me.homeX : me.x, cy = me.homeY != null ? me.homeY : me.y;
  me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0; me.h = me.target = -Math.PI / 2;
  const ids = ['speed','slow','invert','wide','ice','ghost','dark','radar'];
  const cols = 4, dx = 3.7, dy = 4.4;
  let n = 0;
  ids.forEach((id, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = g.wrap(cx + (col - 1.5) * dx);
    const y = g.wrap(cy + (row - 1) * dy);
    packs.packs.push({ id: ++n, x, y, effectId: id });
  });
  packs.nextId = n + 1;
  window.__lockPos = window.__lockPos || setInterval(() => {
    if (!me.alive) return;
    me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0;
  }, 30);
  return { reveal: !!packs.reveal, count: packs.packs.length, speed: g.SPEED, feed: (document.getElementById('feed')||{}).textContent || '' };
}'''

PLACE_TRAPS = '''() => {
  const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
  packs.packs.length = 0; packs.spawnCD = 1e9; packs.trapLootCD = 1e9;
  if (k.pits) k.pits.pits.length = 0;
  g.players.forEach(p => { p.invulnUntil = 1e9; if (p !== me) { p.x = p.px = 2; p.y = p.py = 2; p.trail.length = 0; } });
  const cx = me.homeX != null ? me.homeX : me.x, cy = me.homeY != null ? me.homeY : me.y;
  me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0; me.h = me.target = -Math.PI / 2;
  let n = 0;
  // שורת קופסאות הפתעה
  ['speed','ice','radar'].forEach((id, i) => {
    packs.packs.push({ id: ++n, x: g.wrap(cx + (i - 1) * 3.6), y: g.wrap(cy - 4.2), effectId: id });
  });
  // מלכודות איסוף גלויות
  for (let i = 0; i < 3; i++) {
    packs.packs.push({ id: ++n, x: g.wrap(cx + (i - 1) * 3.6), y: g.wrap(cy + 3.8), effectId: 'trap', kind: 'traploot' });
  }
  packs.nextId = n + 1;
  window.__lockPos = window.__lockPos || setInterval(() => {
    if (!me.alive) return;
    me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0;
  }, 30);
  return { reveal: !!packs.reveal, gifts: packs.regularCount(), traps: packs.trapLootCount(), itemsOn: !!k.itemsOn };
}'''

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))

        print('תפריט')
        pg.goto('http://127.0.0.1:8782/', wait_until='load')
        pg.wait_for_timeout(500)
        btn = pg.evaluate("document.querySelector('#speedSeg button[data-v=\"fast\"]').textContent")
        R['menu_btn'] = btn
        check(btn and 'מצב אקסטרים' in btn, 'כפתור התפריט: «מצב אקסטרים» (קיבל: %s)' % btn)
        check(pg.evaluate("document.querySelector('#speedSeg button[data-v=\"fast\"]').dataset.v") == 'fast', 'המזהה הפנימי נשאר fast')
        check(pg.evaluate("document.querySelector('#speedSeg button.on').dataset.v") == 'normal', 'ברירת מחדל: מהירות רגילה')
        help_txt = pg.evaluate("document.querySelector('#help').innerText")
        check('מצב אקסטרים' in help_txt and 'מצב מהיר' not in help_txt, 'בעזרה: מצב אקסטרים, בלי «מצב מהיר»')
        os.makedirs(os.path.dirname(SHOT_MENU) or '.', exist_ok=True)
        pg.screenshot(path=SHOT_MENU, full_page=False)
        check(os.path.isfile(SHOT_MENU) and os.path.getsize(SHOT_MENU) > 10000, 'צילום תפריט: ' + SHOT_MENU)

        print('מצב אקסטרים – קופסאות הפתעה')
        pg.click('#speedSeg button[data-v="fast"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        check(pg.evaluate("window.__kovesh.state") == 'play', 'משחק אקסטרים התחיל')
        extreme = pg.evaluate(PLACE_GIFTS)
        R['extreme'] = extreme
        check(extreme['reveal'] is False, 'מצב אקסטרים: packs.reveal כבוי')
        check(extreme['count'] == 8, '8 הפתעות על המפה')
        check('מצב אקסטרים' in extreme['feed'], 'הודעת «מצב אקסטרים» בפיד')
        ink = pg.evaluate("""() => {
          function draw(pack, reveal) {
            const c = document.createElement('canvas'); c.width = 90; c.height = 90;
            const x = c.getContext('2d');
            x.fillStyle = '#f4f6fa'; x.fillRect(0,0,90,90);
            Packs.draw(x, 45, 45, 24, 400, pack, { reveal });
            const d = x.getImageData(20, 20, 50, 50).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i+3] > 20 && (Math.abs(d[i]-244)>8 || Math.abs(d[i+1]-246)>8 || Math.abs(d[i+2]-250)>8)) n++;
            return n;
          }
          return {
            giftOff: draw({ effectId: 'speed' }, false),
            giftExtreme: draw({ effectId: 'speed' }, Packs.revealForSpeed('fast')),
            radar: draw({ effectId: 'radar' }, Packs.revealForSpeed('fast')),
            heart: draw({ kind: 'life', effectId: 'life' }, false),
            trap: draw({ kind: 'traploot', effectId: 'trap' }, false)
          };
        }""")
        R['ink'] = ink
        check(ink['giftOff'] > 30 and ink['giftExtreme'] > 30 and ink['radar'] > 30, '🎁 מצויר במצב אקסטרים (%s)' % ink)
        # השוואת חתימה: האצה ורדאר בלי reveal צריכים להיות אותו 🎁
        same = pg.evaluate("""() => {
          function sig(pack, reveal) {
            const c = document.createElement('canvas'); c.width = 90; c.height = 90;
            const x = c.getContext('2d');
            x.fillStyle = '#f4f6fa'; x.fillRect(0,0,90,90);
            Packs.draw(x, 45, 45, 24, 0, pack, { reveal, reduced: true });
            return Array.from(x.getImageData(0,0,90,90).data);
          }
          const a = sig({ effectId: 'speed' }, false);
          const b = sig({ effectId: 'radar' }, Packs.revealForSpeed('fast'));
          let diff = 0;
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
          return diff;
        }""")
        check(same == 0, 'האצה ורדאר במצב אקסטרים נראים אותו 🎁 (diff=%s)' % same)
        check(ink['heart'] > 30 and ink['trap'] > 30, '❤️ ומלכודת איסוף מצוירים גם בלי reveal')
        pg.wait_for_timeout(300)
        os.makedirs(os.path.dirname(SHOT_EXTREME) or '.', exist_ok=True)
        pg.screenshot(path=SHOT_EXTREME, full_page=False)
        check(os.path.isfile(SHOT_EXTREME) and os.path.getsize(SHOT_EXTREME) > 10000, 'צילום אקסטרים: ' + SHOT_EXTREME)

        print('מצב מלכודת + אקסטרים')
        pg.goto('http://127.0.0.1:8782/', wait_until='load')
        pg.wait_for_timeout(400)
        pg.click('#speedSeg button[data-v="fast"]')
        pg.click('#trapSeg button[data-v="on"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        check(pg.evaluate("window.__kovesh.state") == 'play', 'משחק אקסטרים+מלכודת התחיל')
        traps = pg.evaluate(PLACE_TRAPS)
        R['traps'] = traps
        check(traps['reveal'] is False, 'גם עם מלכודות: reveal כבוי')
        check(traps['gifts'] == 3 and traps['traps'] == 3, '3 קופסאות ו-3 מלכודות איסוף')
        check(traps['itemsOn'] is True, 'מצב מלכודת פעיל')
        pg.wait_for_timeout(300)
        os.makedirs(os.path.dirname(SHOT_TRAPS) or '.', exist_ok=True)
        pg.screenshot(path=SHOT_TRAPS, full_page=False)
        check(os.path.isfile(SHOT_TRAPS) and os.path.getsize(SHOT_TRAPS) > 10000, 'צילום מלכודות: ' + SHOT_TRAPS)

        ctx.close(); b.close()
finally:
    srv.terminate()
check(not errors, 'בלי שגיאות דף ' + (json.dumps(errors, ensure_ascii=False) if errors else ''))
print(json.dumps(R, ensure_ascii=False, indent=2))
print('PASS' if not fails else 'FAIL: ' + json.dumps(fails, ensure_ascii=False))
sys.exit(1 if fails else 0)
