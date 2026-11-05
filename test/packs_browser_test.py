#!/usr/bin/env python3
"""בדיקת דפדפן קצרה ל-v9.5 חבילות הפתעה."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
url = 'http://127.0.0.1:8766/'
errors, results = [], {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url, wait_until='load')
        pg.wait_for_timeout(500)
        results['menu'] = pg.is_visible('#playBtn')
        results['ver'] = pg.evaluate("document.getElementById('verTag').textContent")
        results['booted'] = pg.evaluate('!!window.__evBooted')
        results['packsModule'] = pg.evaluate('typeof Packs')
        pg.click('#playBtn')
        pg.wait_for_timeout(800)
        st = pg.evaluate('''() => {
          const k = window.__kovesh, g = k.game, packs = k.packs;
          return {
            state: k.state,
            bots: g.players.filter(p => p.isBot).length,
            packCount: packs.packs.length,
            max: Packs.maxFor(g.W),
            icons: packs.packs.every(p => true),
            tick: g.tickNo
          };
        }''')
        results['play'] = st
        # force spawn near player and pick
        pick = pg.evaluate('''() => {
          const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
          packs.packs.length = 0; packs.spawnCD = 9999; // מונע הופעה באותו צעד
          const sp = packs.spawnOne(g, { x: me.x + 0.3, y: me.y });
          me.x = sp.x; me.y = sp.y;
          const ev = packs.tick(g);
          const a = packs.activeOf(me.id);
          return { picked: ev.some(e => e.type === 'pick'), empty: packs.packs.length === 0, effect: a && a.effectId, speedMul: me.speedMul };
        }''')
        results['pick'] = pick
        # האצה בכוח ובדיקת תנועה
        speed = pg.evaluate('''() => {
          const g = window.__kovesh.game, me = window.__kovesh.me, packs = window.__kovesh.packs;
          packs.apply(g, me, 'speed', g.tickNo);
          const x0 = me.x; me.h = me.target = 0;
          for (let i = 0; i < 30; i++) g.step();
          return { mul: me.speedMul, moved: Math.abs(g.wd(me.x - x0)) };
        }''')
        results['speed'] = speed
        pg.wait_for_timeout(1500)
        results['stillPlay'] = pg.evaluate('window.__kovesh.state')
        results['errors'] = errors
        b.close()
finally:
    srv.terminate()
print(json.dumps(results, ensure_ascii=False, indent=2))
ok = (results.get('menu') and results.get('booted') and results.get('packsModule') == 'function'
      and results.get('play',{}).get('state')=='play' and results.get('play',{}).get('packCount',0) > 0
      and results.get('pick',{}).get('picked') and results.get('speed',{}).get('mul',0) > 1
      and results.get('speed',{}).get('moved',0) > 5 and not errors)
print('PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
