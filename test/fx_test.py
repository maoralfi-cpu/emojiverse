#!/usr/bin/env python3
"""v9: בדיקת אפקטים בדפדפן + תמונות תצוגה.
מכריח כל סוג פסילה וכיבוש גדול ליד השחקן, בודק שאין שגיאות, מודד FPS בעומס, ומצלם פריימים לגיליון מגע ולוידאו.
/home/box/factory/tools/.venv/bin/python test/fx_test.py [URL]"""
import sys, os, subprocess, time, json, base64, glob, shutil
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8769', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8769/'
OUT = os.path.join(ROOT, 'test', 'shots', 'fx'); os.makedirs(OUT, exist_ok=True)
VID = os.path.join(OUT, 'video'); shutil.rmtree(VID, ignore_errors=True)
errs, res = [], {}
# כל אפקט: קוד JS שמפעיל אותו ליד השחקן (בוט מוצב בהיסט dx,dy מהשחקן)
SETUP = """(kind) => { const k = window.__kovesh, g = k.game, me = k.me;
  me.trail = []; me.target = me.h;
  g.players.forEach(p => { if (p !== me && !p.alive && !p.gone) g.spawn(p); });
  const bots = g.players.filter(p => p !== me && p.alive);
  const v = bots[0], w = bots[1];
  const place = (p, dx, dy) => { p.x = p.px = g.wrap(me.x + dx); p.y = p.py = g.wrap(me.y + dy); };
  if (kind === 'big') {
    const box = [me.x - 1, me.y - 6, me.x + 6, me.y + 0.5];
    return k.fxCapture(me, 1400, 1100, v.id, box);
  }
  place(v, 3, -2.2);
  if (kind === 'trail') { v.trail = []; for (let i = 0; i < 40; i++) v.trail.push(v.x - 6 + i * 0.25, v.y + Math.sin(i * 0.3) * 1.2); place(w, 1.5, -2.6); g.kill(v, me, 'trail'); }
  else if (kind === 'enclosed') g.kill(v, me, 'enclosed');
  else if (kind === 'head') { place(w, 4.6, -1.6); g.kill(v, w, 'head'); }
  else if (kind === 'self') g.kill(v, null, 'self');
  else if (kind === 'territory') { g._capBox = [v.x - 3, v.y - 3, v.x + 3, v.y + 3]; g.kill(v, w, 'territory'); g._capBox = null; }
  else if (kind === 'left') g.kill(v, null, 'left');
  return kind; }"""
KINDS = ['trail', 'enclosed', 'head', 'self', 'territory', 'big', 'left']
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, record_video_dir=VID, record_video_size={'width': 412, 'height': 915})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errs.append(m.text))
        pg.goto(url, wait_until='load')
        pg.evaluate("localStorage.setItem('kovesh.settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('kovesh.settings')||'{}'), {bots:6, size:130, fx:'full', fps:60})))")
        pg.reload(wait_until='load'); pg.click('#playBtn'); pg.wait_for_timeout(600)
        # שחקן נוסע לאט בעיגול רחב בתוך השטח שלו – מצלמה כמעט קבועה
        pg.evaluate("""() => { const k = window.__kovesh; setInterval(() => { const g = k.game, me = k.me; if (!g || !me.alive) return;
            me.target = Math.atan2(g.wd(me.homeY - me.y), g.wd(me.homeX - me.x)) + 1.2; me.trail = []; }, 30); }""")
        frames = {}
        for kind in KINDS:
            if pg.evaluate("window.__kovesh.state") != 'play': pg.evaluate("window.__kovesh.start()"); pg.wait_for_timeout(800)
            pg.evaluate(SETUP, kind)
            shots = []
            t0 = time.time()
            for ms in (60, 200, 360, 560):
                dt = ms / 1000 - (time.time() - t0)
                if dt > 0: pg.wait_for_timeout(dt * 1000)
                f = os.path.join(OUT, f'{kind}_{ms}.png')
                pg.screenshot(path=f, clip={'x': 56, 'y': 230, 'width': 300, 'height': 300})
                shots.append(f)
            frames[kind] = shots
            res['particles_after_' + kind] = pg.evaluate("window.__kovesh.fx.count()")
            pg.wait_for_timeout(900)
        # עומס: כל האפקטים כל 120ms במשך 3 שניות – מודדים FPS ושומרים על התקרה
        fps = pg.evaluate("""(SET) => new Promise(r => { const kinds = ['trail','enclosed','head','self','territory','big'];
            const setup = eval(SET); let i = 0, maxP = 0; const k = window.__kovesh;
            const iv = setInterval(() => { try { if (k.state === 'play') { const bots = k.game.players.filter(p => p !== k.me && p.alive); if (bots.length >= 2) setup(kinds[i++ % kinds.length]); } } catch (e) {} maxP = Math.max(maxP, k.fx.count()); }, 120);
            const f0 = k.frames, t0 = performance.now();
            setTimeout(() => { clearInterval(iv); r({ fps: (k.frames - f0) / ((performance.now() - t0) / 1000), maxParticles: maxP, specials: k.fx.activeSpecials() }); }, 3000); })""", SETUP)
        res['stress'] = {k: round(v, 1) if isinstance(v, float) else v for k, v in fps.items()}
        f0 = pg.evaluate("window.__kovesh.frames"); pg.wait_for_timeout(2000); res['idle_fps'] = round((pg.evaluate("window.__kovesh.frames") - f0) / 2, 1)
        # גיליון מגע: מרכיבים בדפדפן עצמו (בלי ספריות תמונה)
        data = {k: [base64.b64encode(open(f, 'rb').read()).decode() for f in v] for k, v in frames.items()}
        names = {'trail': 'שובל נחתך', 'enclosed': 'נכלא', 'head': 'ראש בראש', 'self': 'שובל עצמי', 'territory': 'שטח נמחק', 'big': 'כיבוש גדול', 'left': 'עזב'}
        sheet = pg.evaluate("""async ([data, names]) => { const S = 220, P = 8, cols = 4, kinds = Object.keys(data);
            const c = document.createElement('canvas'); c.width = 130 + cols * (S + P); c.height = kinds.length * (S + P) + 40; const x = c.getContext('2d');
            x.fillStyle = '#eceff4'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#3b4252'; x.font = '700 18px system-ui'; x.textAlign = 'center';
            ['60ms','200ms','360ms','560ms'].forEach((t, i) => x.fillText(t, 130 + i * (S + P) + S / 2, 26));
            for (let r = 0; r < kinds.length; r++) { x.textAlign = 'right'; x.font = '700 17px system-ui'; x.fillText(names[kinds[r]], 120, 40 + r * (S + P) + S / 2);
              for (let i = 0; i < data[kinds[r]].length; i++) { const im = new Image(); im.src = 'data:image/png;base64,' + data[kinds[r]][i]; await im.decode(); x.drawImage(im, 130 + i * (S + P), 40 + r * (S + P), S, S); } }
            return c.toDataURL('image/png'); }""", [data, names])
        open(os.path.join(OUT, 'contact_sheet.png'), 'wb').write(base64.b64decode(sheet.split(',')[1]))
        pg.close(); ctx.close(); b.close()
        vids = glob.glob(os.path.join(VID, '*.webm'))
        if vids: shutil.move(vids[0], os.path.join(OUT, 'effects.webm')); shutil.rmtree(VID, ignore_errors=True)
finally:
    if srv: srv.terminate()
res['errors'] = errs
print(json.dumps(res, ensure_ascii=False, indent=1))
ok = not errs and res['stress']['fps'] >= 50 and res['stress']['maxParticles'] <= 300 and res['idle_fps'] >= 50 and os.path.exists(os.path.join(OUT, 'contact_sheet.png'))
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
