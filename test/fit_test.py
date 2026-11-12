#!/usr/bin/env python3
"""v7: כל המסכים נכנסים בגובה המסך בלי גלילה.
/home/box/factory/tools/.venv/bin/python test/fit_test.py [URL]
בודק בכל גודל: document scrollHeight <= גובה החלון, והכרטיס עצמו לא חתוך (scrollHeight <= clientHeight)."""
import sys, os, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8766/'
SIZES = [(360, 640), (393, 873), (412, 915), (640, 360), (915, 412)]
SCREENS = ['menu', 'settings', 'help', 'over', 'online', 'lobby', 'lobbylives', 'results']
CHECK = """(id) => { const s = document.getElementById(id), c = s.querySelector('.card');
  const d = document.scrollingElement;
  // כל רכיב גלוי בכרטיס חייב להיות בתוך גבולות הכרטיס
  const cr = c.getBoundingClientRect(); let out = 0;
  c.querySelectorAll('button,input,h1,h2,.label,.seg,#avatarPick,.avgrid,ul,ol').forEach(e => { if (!e.offsetParent) return;
    if (e.tagName === 'LI') return;   /* פריטי רשימה – הרשימה עצמה גוללת פנימית אם צריך */
    const r = e.getBoundingClientRect(); if (r.height && (r.bottom > cr.bottom + 1 || r.top < cr.top - 1 || (e.id !== 'avatarPick' && !e.classList.contains('avgrid') && !e.closest('#avatarPick,.avgrid') && (r.left < cr.left - 1 || r.right > cr.right + 1)))) out++; });
  return { doc: d.scrollHeight, vh: innerHeight, card: c.scrollHeight, cardClient: c.clientHeight, cardBottom: Math.round(cr.bottom), out, wide: c.scrollWidth > c.clientWidth + 1 || cr.left < 0 || cr.right > innerWidth }; }"""
fails, report = [], {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        for (w, h) in SIZES:
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(url + '?transport=local', wait_until='load'); pg.wait_for_timeout(300)
            for sc in SCREENS:
                if sc == 'lobbylives':   # v9.13: מצב חיים – שורת החיים במקום שורת הזמן
                    pg.evaluate("window.__koveshNet.setCfg({mode:'lives', lives:5})"); pg.wait_for_timeout(200)
                    pg.evaluate("(() => { const ul = document.getElementById('lobbyPlayers'); const li = ul.querySelector('li'); while (ul.children.length < 6) ul.appendChild(li.cloneNode(true)); })()")
                elif sc == 'lobby':
                    pg.evaluate("document.querySelectorAll('section.screen').forEach(s=>s.classList.add('hidden'));document.getElementById('menu').classList.remove('hidden')")
                    pg.click('#onlineBtn'); pg.click('#hostBtn'); pg.wait_for_timeout(1200)
                    # חדר מלא: 6 שחקנים ברשימה (הגרוע ביותר לגובה)
                    pg.evaluate("""() => { const ul = document.getElementById('lobbyPlayers'); const li = ul.querySelector('li');
                      for (let i = 0; i < 5; i++) { const c = li.cloneNode(true); ul.appendChild(c); } }""")
                else:
                    pg.evaluate("""(id) => { document.querySelectorAll('section.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
                      if (id === 'results') { const ol = document.getElementById('rankList'); ol.innerHTML = '';
                        for (let i = 0; i < 8; i++) { const li = document.createElement('li'); li.innerHTML = (['🥇','🥈','🥉'][i] || (i+1)+'.') + ' <span class="emo-s">🦊</span><span class="nm">שחקן ' + (i+1) + '</span><span class="p">12.3% · ⚔️2</span>'; ol.appendChild(li); }
                        document.getElementById('resultsWait').classList.add('hidden');
                        const w = document.getElementById('winnerLine'); w.textContent = '🏆 המנצח/ת: 🐼 נועה'; w.classList.remove('hidden');
                        const a = document.getElementById('awardsRow'); a.innerHTML = '<div class="award-chip">🗡️ מלך החיסולים: 🦁 מאור</div><div class="award-chip">🗺️ מלך השטח: 🐼 נועה</div>'; }
                      if (id === 'over') { document.getElementById('overReason').textContent = 'נגעת בשובל של עצמך – בוט'; document.getElementById('overAvatar').src = ''; } }""", sc)
                pg.wait_for_timeout(150)
                r = pg.evaluate(CHECK, 'lobby' if sc == 'lobbylives' else sc)
                good = r['doc'] <= r['vh'] and r['card'] <= r['cardClient'] + 1 and r['out'] == 0 and not r['wide']
                report[f'{w}x{h}:{sc}'] = ('OK ' if good else 'FAIL ') + json.dumps(r)
                if not good: fails.append(f'{w}x{h}:{sc}')
                if True:
                    pg.screenshot(path=os.path.join(ROOT, 'test', 'shots', f'fit_{sc}_{w}x{h}.png'))
            if errs: fails.append(f'{w}x{h}: errors {errs}')
            if sc == 'lobby' or True:
                pg.evaluate("document.getElementById('leaveBtn').click()")
            ctx.close()
        b.close()
finally:
    if srv: srv.terminate()
for k, v in report.items(): print(k, v)
print('FAILS:', fails if fails else 'none')
sys.exit(1 if fails else 0)
