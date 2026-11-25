#!/usr/bin/env python3
"""v9.22 הפתעות גלויות במצב מהיר – בדיקת דפדפן (טלפון 412×915).
במצב מהיר מציגים משטחים לפי סוג; במצב רגיל נשאר 🎁. שומר צילום ל-/workspace/v922_surfaces.png."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v922_surfaces.png'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8782', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, fails, R = [], [], {}
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
IDS = ['speed', 'slow', 'invert', 'wide', 'life', 'ice', 'ghost', 'dark', 'radar', 'trap', 'bomb']
PLACE = '''() => {
  const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
  packs.packs.length = 0; packs.spawnCD = 1e9;
  if (k.pits) k.pits.pits.length = 0;
  g.players.forEach(p => { p.invulnUntil = 1e9; if (p !== me) { p.x = p.px = 2; p.y = p.py = 2; p.trail.length = 0; } });
  const cx = me.homeX != null ? me.homeX : me.x, cy = me.homeY != null ? me.homeY : me.y;
  me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0; me.h = me.target = -Math.PI / 2;
  const ids = %s;
  const cols = 4, dx = 3.7, dy = 4.4;
  let n = 0;
  ids.forEach((id, i) => {
    const col = i %% cols, row = Math.floor(i / cols);
    const x = g.wrap(cx + (col - 1.5) * dx);
    const y = g.wrap(cy + (row - 1) * dy);
    const pack = { id: ++n, x, y, effectId: id };
    if (id === 'life') pack.kind = 'life';
    packs.packs.push(pack);
  });
  packs.nextId = n + 1;
  window.__lockPos = window.__lockPos || setInterval(() => {
    if (!me.alive) return;
    me.x = me.px = cx; me.y = me.py = cy; me.trail.length = 0;
  }, 30);
  return { reveal: !!packs.reveal, count: packs.packs.length, looks: packs.packs.map(p => Packs.lookOf(p)), speed: g.SPEED };
}''' % json.dumps(IDS)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))

        print('מצב רגיל')
        pg.goto('http://127.0.0.1:8782/', wait_until='load')
        pg.wait_for_timeout(500)
        check(pg.evaluate("document.querySelector('#speedSeg button.on').dataset.v") == 'normal', 'ברירת מחדל: מהירות רגילה')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        check(pg.evaluate("window.__kovesh.state") == 'play', 'משחק רגיל התחיל')
        normal = pg.evaluate(PLACE)
        R['normal'] = normal
        check(normal['reveal'] is False, 'מצב רגיל: packs.reveal כבוי')
        gift = pg.evaluate("""() => {
          const c = document.createElement('canvas'); c.width = 80; c.height = 80;
          const x = c.getContext('2d');
          Packs.draw(x, 40, 40, 22, 0, { effectId: 'speed' }, { reveal: false });
          return x.getTransform && Packs.lookOf({ effectId: 'speed' }) === 'boost';
        }""")
        # Sample canvas pixels around packs: in normal mode we only check the API path + no reveal.
        drawn = pg.evaluate("""() => {
          const results = {};
          ['speed','slow','life'].forEach(id => {
            const c = document.createElement('canvas'); c.width = 90; c.height = 90;
            const x = c.getContext('2d');
            x.fillStyle = '#f4f6fa'; x.fillRect(0,0,90,90);
            const pack = id === 'life' ? { kind: 'life', effectId: 'life' } : { effectId: id };
            Packs.draw(x, 45, 45, 24, 400, pack, { reveal: false });
            const d = x.getImageData(20, 20, 50, 50).data;
            let ink = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i+3] > 20 && (Math.abs(d[i]-244)>8 || Math.abs(d[i+1]-246)>8 || Math.abs(d[i+2]-250)>8)) ink++;
            results[id] = ink;
          });
          return results;
        }""")
        R['normal_ink'] = drawn
        check(drawn['speed'] > 30 and drawn['life'] > 30, 'מצב רגיל: 🎁 ו-❤️ באמת מצוירים (%s)' % drawn)
        pg.screenshot(path=os.path.join(os.path.dirname(SHOT) or '.', 'v922_normal_gift.png'))

        print('מצב מהיר')
        pg.goto('http://127.0.0.1:8782/', wait_until='load')
        pg.wait_for_timeout(400)
        pg.click('#speedSeg button[data-v="fast"]')
        pg.click('#playBtn')
        pg.wait_for_timeout(900)
        check(pg.evaluate("window.__kovesh.state") == 'play', 'משחק מהיר התחיל')
        fast = pg.evaluate(PLACE)
        R['fast'] = fast
        check(fast['reveal'] is True, 'מצב מהיר: packs.reveal דולק')
        check(fast['count'] == 11, '11 משטחים על המפה')
        expected = ['boost','mud','vortex','beacon','heart','ice','mist','lantern','radar','snare','mine']
        check(fast['looks'] == expected, 'lookOf לכל הסוגים: ' + json.dumps(fast['looks'], ensure_ascii=False))
        # Pixel signatures: boost lane vs gift should differ; each type should paint something
        sig = pg.evaluate("""() => {
          function ink(reveal, id) {
            const c = document.createElement('canvas'); c.width = 90; c.height = 90;
            const x = c.getContext('2d');
            x.fillStyle = '#f4f6fa'; x.fillRect(0,0,90,90);
            const pack = id === 'life' ? { kind: 'life', effectId: 'life' } : { effectId: id };
            Packs.draw(x, 45, 45, 24, 900, pack, { reveal });
            const d = x.getImageData(0, 0, 90, 90).data;
            let n = 0, r = 0, g = 0, b = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i+3] > 20 && (Math.abs(d[i]-244)>8 || Math.abs(d[i+1]-246)>8 || Math.abs(d[i+2]-250)>8)) {
                n++; r += d[i]; g += d[i+1]; b += d[i+2];
              }
            }
            return n ? [n, Math.round(r/n), Math.round(g/n), Math.round(b/n)] : [0,0,0,0];
          }
          const ids = %s;
          const out = {};
          ids.forEach(id => { out[id] = { gift: ink(false, id), surf: ink(true, id) }; });
          return out;
        }""" % json.dumps(IDS))
        R['sig'] = sig
        # gift look for non-life should match across types (same 🎁), surfaces should differ
        gift_n = sig['speed']['gift'][0]
        check(gift_n > 30, '🎁 במצב רגיל מצייר פיקסלים')
        check(sig['life']['gift'][0] > 30 and sig['life']['surf'][0] > 30, '❤️ מצויר בשני המצבים')
        # surfaces of speed/slow should not match the gift average color too closely AND should differ from each other
        def dist(a, b):
            return abs(a[1]-b[1]) + abs(a[2]-b[2]) + abs(a[3]-b[3])
        check(sig['speed']['surf'][0] > 40, 'מסלול האצה מצויר')
        check(dist(sig['speed']['surf'], sig['slow']['surf']) > 40, 'האצה ובוץ בצבעים שונים')
        check(dist(sig['speed']['surf'], sig['speed']['gift']) > 25, 'מסלול האצה שונה מ-🎁')
        all_ok = all(sig[i]['surf'][0] > 20 for i in IDS)
        check(all_ok, 'כל 11 הסוגים מציירים משטח (או ❤️)')

        pg.evaluate("""() => {
          ['board','stats','feed'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
          const box = document.createElement('div');
          box.id = 'v922legend';
          box.style.cssText = 'position:fixed;bottom:92px;left:8px;right:8px;z-index:99;background:rgba(46,52,64,.9);color:#eceff4;font:11px/1.4 system-ui,sans-serif;padding:8px 10px;border-radius:10px;text-align:right;pointer-events:none';
          box.textContent = 'v9.23 מצב מהיר: ⚡מסלול  🐢בוץ  🌀מערבולת  🔭מגדלור  ❤️לב  🧊קרח  👻ערפל  🔦פנס  📡רדאר  🪤מלכודת  💣מוקש';
          document.body.appendChild(box);
        }""")
        pg.wait_for_timeout(400)
        os.makedirs(os.path.dirname(SHOT) or '.', exist_ok=True)
        pg.screenshot(path=SHOT, full_page=False)
        check(os.path.isfile(SHOT) and os.path.getsize(SHOT) > 10000, 'צילום נשמר: ' + SHOT)

        ctx.close(); b.close()
finally:
    srv.terminate()
check(not errors, 'בלי שגיאות דף ' + (json.dumps(errors, ensure_ascii=False) if errors else ''))
print(json.dumps({k: R[k] for k in R if k != 'sig'}, ensure_ascii=False, indent=2))
print('PASS' if not fails else 'FAIL: ' + json.dumps(fails, ensure_ascii=False))
sys.exit(1 if fails else 0)
