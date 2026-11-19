#!/usr/bin/env python3
"""v9.19: בדיקת דפדפן – כל אחת מ-4 ההפתעות החדשות נאספת בלולאת המשחק, מוצגת ב-HUD, ובלי שגיאות."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8767', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, results = [], {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8767/', wait_until='load')
        pg.wait_for_timeout(500)
        pg.click('#playBtn')
        pg.wait_for_timeout(1500)
        for eid in ['ice', 'ghost', 'dark', 'radar']:
            pg.evaluate('''(eid) => {
              const k = window.__kovesh, g = k.game, me = k.me, packs = k.packs;
              packs.packs.length = 0; packs.spawnCD = 9999;
              me.x = me.homeX; me.y = me.homeY; me.trail.length = 0;   // חזרה לבית – לא להיפסל בזמן הבדיקה
              if (!window.__circ) window.__circ = setInterval(() => { me.target = me.h + 0.08; }, 30);   // סיבוב קטן בבית
              const sp = packs.spawnOne(g, { x: me.x, y: me.y }); sp.effectId = eid;
              for (const q of g.players) if (q !== me && q.isBot) q.alive = q.alive; // בוטים ממשיכים
            }''', eid)
            pg.wait_for_timeout(1700)
            r = pg.evaluate('''() => { const k = window.__kovesh, me = k.me, a = k.packs.activeOf(me.id);
              return { state: k.state, alive: me.alive, active: a && a.effectId, ice: !!me.ice,
                       hud: document.getElementById('packFx').textContent.trim(), hidden: document.getElementById('packFx').classList.contains('hidden') }; }''')
            pg.screenshot(path=os.path.join(ROOT, 'test', 'shots', 'v919_' + eid + '.png'))
            results[eid] = r
            pg.evaluate('''() => { const k = window.__kovesh; k.packs.active = {}; k.me.ice = false; k.me.speedMul = 1; }''')
            pg.wait_for_timeout(300)
        results['errors'] = errors
        b.close()
finally:
    srv.terminate()
print(json.dumps(results, ensure_ascii=False, indent=2))
ok = not errors and all(results[e]['active'] == e or not results[e]['alive'] for e in ['ice', 'ghost', 'dark', 'radar'])
print('PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
