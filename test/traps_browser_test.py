#!/usr/bin/env python3
"""v9.21 מצב מלכודת (סעיף 23) – בדיקת דפדפן בסולו עם בוטים, תצוגת טלפון 412×915.
בודק: מתג בתפריט נשמר, איסוף פריט לתא, הכפתור מופיע, 🪤 מקפיא בוט, 💣 ספירה+פיצוץ שפוסל ראש ברדיוס
ומנטרל שטח יריב, ובלי שגיאות קונסול. שומר צילום ל-/workspace/v921_traps.png."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8781', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, R = [], {}
SHOT = sys.argv[1] if len(sys.argv) > 1 else '/workspace/v921_traps.png'
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://127.0.0.1:8781/', wait_until='load'); pg.wait_for_timeout(500)
        R['toggle_default_off'] = pg.evaluate("document.querySelector('#trapSeg button.on').dataset.v") == 'off'
        pg.click('#trapSeg button[data-v="on"]')
        R['toggle_saved'] = pg.evaluate("JSON.parse(localStorage.getItem('kovesh.settings')).traps") == 'on'
        pg.reload(wait_until='load'); pg.wait_for_timeout(400)
        R['toggle_remembered'] = pg.evaluate("document.querySelector('#trapSeg button.on').dataset.v") == 'on'
        pg.click('#playBtn'); pg.wait_for_timeout(1200)
        R['items_on'] = pg.evaluate("window.__kovesh.itemsOn && window.__kovesh.packs.pool().length === 10")
        # הגנה לבדיקה: אני מסתובב/ת בבית
        pg.evaluate("""() => { const k = window.__kovesh, me = k.me;
          window.__home = () => { me.x = me.px = me.homeX; me.y = me.py = me.homeY; me.trail.length = 0; };
          me.invulnUntil = 1e9;   // הגנה לבדיקה מבוטים (התנגשויות רגילות); פצצה/מלכודת נבדקות על בוטים
          window.__home(); window.__circ = setInterval(() => { if (me.alive) { me.target = me.h + 0.08; if (me.trail.length) window.__home(); } }, 30);
          k.packs.packs.length = 0; k.packs.spawnCD = 1e9; }""")
        # 1) איסוף 💣 מקופסה => בתא, כפתור עם 💣, בלי אפקט
        pg.evaluate("""() => { const k = window.__kovesh, sp = k.packs.spawnOne(k.game, { x: k.me.x, y: k.me.y }); sp.effectId = 'bomb'; }""")
        pg.wait_for_timeout(600)
        R['pickup_slot'] = pg.evaluate("[window.__kovesh.me.item, !!window.__kovesh.packs.activeOf(window.__kovesh.me.id)]")
        R['button_visible'] = pg.evaluate("(()=>{const e=document.getElementById('itemBtn');const r=e.getBoundingClientRect();return {shown:!e.classList.contains('hidden'),txt:e.textContent,x:r.left,y:r.top,w:r.width,h:r.height}})()")
        # הכפתור לא חופף ל-HUD (מפה קטנה, סטטוס, לוח, ⏸, חבילה פעילה)
        R['button_no_overlap'] = pg.evaluate("""(()=>{const a=document.getElementById('itemBtn').getBoundingClientRect();
          return ['minimap','stats','board','pauseBtn','packFx','feed'].every(id=>{const e=document.getElementById(id);if(!e||e.classList.contains('hidden'))return true;const r=e.getBoundingClientRect();if(!r.width)return true;
          return a.right<=r.left||a.left>=r.right||a.bottom<=r.top||a.top>=r.bottom;})})()""")
        # 2) 🪤: מחזיק מלכודת, לחיצה על הכפתור => מלכודת במיקום שלי; בוט שנכנס נקפא 2 שנ'
        pg.evaluate("window.__kovesh.me.item = 'trap'"); pg.wait_for_timeout(100)
        pg.tap('#itemBtn'); pg.wait_for_timeout(100)
        R['trap_dropped'] = pg.evaluate("window.__kovesh.items.list.map(i=>i.k)")
        R['button_hidden_after_drop'] = pg.evaluate("document.getElementById('itemBtn').classList.contains('hidden')")
        bot = pg.evaluate("""() => { const k = window.__kovesh, g = k.game, t = k.items.list[0];
          t.x = g.wrap(t.x + 10); t.y = g.wrap(t.y + 10);   // הרחק ממני (אחרת ראש-בראש איתי פוסל את הבוט)
          const b = g.players.find(q => q.isBot && q.alive); b.trail.length = 0;
          b.x = b.px = t.x + 0.4; b.y = b.py = t.y; return b.id; }""")
        pg.wait_for_timeout(120)
        f = pg.evaluate("(id)=>{const k=window.__kovesh,b=k.game.players[id-1];return {frozen: b.frozenUntil>k.game.tickNo, x:b.x, y:b.y, alive:b.alive, traps:k.items.list.length}}", bot)
        pg.wait_for_timeout(900)
        f2 = pg.evaluate("(id)=>{const k=window.__kovesh,b=k.game.players[id-1];return {frozen: b.frozenUntil>k.game.tickNo, x:b.x, y:b.y}}", bot)
        pg.wait_for_timeout(1500)
        f3 = pg.evaluate("(id)=>{const k=window.__kovesh,b=k.game.players[id-1];return {frozen: b.frozenUntil>k.game.tickNo, x:b.x, y:b.y, alive:b.alive}}", bot)
        R['trap_freeze'] = {'t0': f, 't1': f2, 't2.5': f3}
        pg.evaluate("(id)=>{const k=window.__kovesh,b=k.game.players[id-1];if(b.alive){b.trail.length=0;b.x=b.px=k.game.wrap(b.x+40);}}", bot)
        R['trap_ok'] = f['frozen'] and f['traps'] == 0 and f['x'] == f2['x'] and f['y'] == f2['y'] and f2['frozen'] and not f3['frozen'] and (not f3['alive'] or f3['x'] != f['x'] or f3['y'] != f['y'])
        # 3) 💣: מטילים ברווח; בוט קפוא ליד הפצצה; שטח בוט אחר ברדיוס; אני בורח/ת
        pg.evaluate("window.__home(); window.__kovesh.me.item = 'bomb'"); pg.wait_for_timeout(80)
        pg.keyboard.press('Space'); pg.wait_for_timeout(50)
        R['space_dbg'] = pg.evaluate("(()=>{const k=window.__kovesh;return {st:k.state,alive:k.me.alive,item:k.me.item,list:k.items.list.map(i=>i.k),act:document.activeElement&&document.activeElement.id}})()")
        print(R["space_dbg"], pg.evaluate("document.getElementById('overReason').textContent"), pg.evaluate("document.getElementById('feed').textContent"))
        setup = pg.evaluate("""() => { const k = window.__kovesh, g = k.game, bm = k.items.list.find(i => i.k === 'bomb');
          const bots = g.players.filter(q => q.isBot && q.alive);
          const v = bots[0], o = bots[1];
          // הקורבן מגיע לפצצה ממש לפני הפיצוץ (בלי להקפיא – גם בריחת הבוט לא מספיקה ב-0.2 שנ')
          window.__vw = setInterval(() => { if (bm.until - g.tickNo <= 12) { clearInterval(window.__vw); v.trail.length = 0; v.x = v.px = bm.x; v.y = v.py = bm.y; } }, 5);
          g.stamp(g.wrap(bm.x - 2.6), bm.y, 0.9, o.id, false);
          const R = 3.5, cnt = id => { let n = 0; for (let dy = -R; dy <= R; dy += 0.5) for (let dx = -R; dx <= R; dx += 0.5) if (dx*dx+dy*dy <= R*R && g.ownerAt(g.wrap(bm.x+dx), g.wrap(bm.y+dy)) === id) n++; return n; };
          window.__cnt = cnt; window.__bm = { x: bm.x, y: bm.y, v: v.id, o: o.id };
          return { bomb: !!bm, v: v.id, o: o.id, oBefore: cnt(o.id), meBefore: cnt(k.me.id), vDeaths: v.deaths }; }""")
        R['bomb_setup'] = setup
        pg.wait_for_timeout(700)
        R['countdown_visible'] = pg.evaluate("(()=>{const k=window.__kovesh,bm=k.items.list.find(i=>i.k==='bomb');return bm?Math.ceil(window.Items.left(bm,k.game.tickNo,performance.now(),k.game.DT)):null})()")
        # צילום: בזמן הספירה, עם כפתור (מחזיק/ה מלכודת) ומלכודת שלי על המפה
        pg.evaluate("""() => { const k = window.__kovesh, me = k.me; me.item = 'trap';
          k.items.list.push({ id: 99, k: 'trap', x: k.game.wrap(window.__bm.x + 2.5), y: k.game.wrap(window.__bm.y - 7.5), o: me.id, until: k.game.tickNo + 1800 }); }""")
        pg.evaluate("() => { const k = window.__kovesh, me = k.me; clearInterval(window.__circ); me.trail.length = 0; me.x = me.px = window.__bm.x - 1; me.y = me.py = k.game.wrap(window.__bm.y - 5); me.h = me.target = -2.3; }")
        pg.wait_for_timeout(200)
        pg.screenshot(path=SHOT)
        # בורחים: מרחק 30 יחידות, קפואים כדי לעמוד במקום בבטחה
        pg.evaluate("""() => { const k = window.__kovesh, me = k.me, g = k.game;
          me.trail.length = 0; me.x = me.px = g.wrap(window.__bm.x + 30); me.y = me.py = window.__bm.y; me.frozenUntil = g.tickNo + 400; }""")
        pg.wait_for_timeout(2600)
        after = pg.evaluate("""() => { const k = window.__kovesh, g = k.game, s = window.__bm, v = g.players[s.v-1];
          return { bombsLeft: k.items.list.filter(i=>i.k==='bomb').length, vAlive: v.alive, vDeaths: v.deaths, oAfter: window.__cnt(s.o), meAfter: window.__cnt(k.me.id), meAlive: k.me.alive, myKills: k.me.kills,
                   feed: document.getElementById('feed').textContent, booms: k.booms.length }; }""")
        R['bomb_after'] = after
        R['bomb_ok'] = after['bombsLeft'] == 0 and after['vDeaths'] > setup['vDeaths'] and setup['oBefore'] > 0 and after['oAfter'] == 0 and after['meAlive'] and '💣' in after['feed']   # שטח המטיל נשאר – נבדק ב-items.test.js (כאן בוטים משנים שטח בזמן הבדיקה)
        R['errors'] = errors
        b.close()
finally:
    srv.terminate()
print(json.dumps(R, ensure_ascii=False, indent=1))
ok = (not errors and R['toggle_default_off'] and R['toggle_saved'] and R['toggle_remembered'] and R['items_on'] and R['pickup_slot'] == ['bomb', False]
      and R['button_visible']['shown'] and R['button_visible']['txt'] == '💣' and R['button_no_overlap'] and R['trap_dropped'] == ['trap'] and R['button_hidden_after_drop']
      and R['trap_ok'] and R['countdown_visible'] in (1, 2, 3) and R['bomb_ok'])
print({k: v for k, v in R.items() if v is False}, R.get('trap_freeze') if not R.get('trap_ok') else '')
print('PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
