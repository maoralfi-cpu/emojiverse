#!/usr/bin/env python3
"""v9.21 מצב מלכודת באונליין: מארח + אורח (צינור מקומי, כמו mp_test.py --local).
המארח מפעיל את המצב בלובי => האורח מקבל אותו; פריט ביד של האורח מסונכרן (כפתור);
האורח מטיל (כפתור / רווח) => המארח יוצר את הפריט => האורח רואה אותו; פיצוץ מגיע לאורח.
הרצה: tools/.venv/bin/python test/traps_mp_test.py"""
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8782', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); url = 'http://127.0.0.1:8782/'
R, errors = {}, []
def ev(pg, js, arg=None): return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
def wait(pg, js, ms=20000):
    t0 = time.time()
    while True:
        try:
            if pg.evaluate('()=>{try{return !!(' + js + ')}catch(e){return false}}'): return True
        except Exception: pass
        if (time.time() - t0) * 1000 > ms: raise TimeoutError('wait: ' + js[:100])
        pg.wait_for_timeout(80)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        def phone(name):
            pg = ctx.new_page()
            pg.add_init_script("if(!sessionStorage.getItem('n')){sessionStorage.setItem('n','1');localStorage.setItem('kovesh.settings', JSON.stringify({name:'%s', v:6, avatar:0}))}" % name)
            pg.on('pageerror', lambda e: errors.append(name + ': ' + str(e)))
            pg.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errors.append(name + ': ' + m.text))
            return pg
        host, guest = phone('מארח'), phone('אורח')
        host.goto(url + '?transport=local'); host.click('#onlineBtn'); host.click('#hostBtn')
        wait(host, "document.getElementById('roomCode').textContent.length===4 && !document.getElementById('lobby').classList.contains('hidden')")
        host.click('#mpBotsSeg button[data-v="1"]')
        host.click('#mpTrapSeg button[data-v="on"]')
        code = ev(host, "document.getElementById('roomCode').textContent")
        guest.goto(url + '?transport=local&room=' + code)
        wait(guest, "!document.getElementById('lobby').classList.contains('hidden') && document.querySelectorAll('#lobbyPlayers li').length>=2", 30000)
        guest.wait_for_timeout(400)
        R['guest_lobby_shows_traps_on'] = ev(guest, "document.querySelector('#mpTrapSeg button.on').dataset.v") == 'on'
        R['guest_cannot_change'] = ev(guest, "document.querySelector('#mpTrapSeg button').disabled")
        host.click('#startBtn')
        wait(guest, "window.__kovesh.state==='play' && window.__kovesh.game && window.__kovesh.me.alive")
        R['itemsOn_both'] = [ev(host, 'window.__kovesh.itemsOn'), ev(guest, 'window.__kovesh.itemsOn')]
        gid = ev(guest, 'window.__kovesh.me.id')
        # מגינים על האורח: השחקן קפוא אצל המארח (עומד בבית) כדי שלא ייפסל באמצע הבדיקה
        safe = "(id)=>{const g=window.__kovesh.game,q=g.players[id-1];if(!q.alive)return;q.trail.length=0;q.x=q.px=q.homeX;q.y=q.py=q.homeY;q.frozenUntil=g.tickNo+100000;}"
        ev(host, safe, gid)
        # 1) פריט ביד מגיע לאורח => כפתור
        ev(host, "(id)=>{window.__kovesh.game.players[id-1].item='trap'}", gid)
        wait(guest, "!document.getElementById('itemBtn').classList.contains('hidden')", 5000)
        R['guest_button'] = ev(guest, "document.getElementById('itemBtn').textContent")
        # 2) האורח לוחץ => המארח מחיל => האורח רואה
        guest.tap('#itemBtn')
        wait(host, "window.__kovesh.items.list.some(i=>i.k==='trap')", 5000)
        R['host_trap_owner_is_guest'] = ev(host, "window.__kovesh.items.list.find(i=>i.k==='trap').o") == gid
        R['host_slot_cleared'] = ev(host, "(id)=>window.__kovesh.game.players[id-1].item", gid) is None
        wait(guest, "window.__kovesh.items.list.some(i=>i.k==='trap' && i.o===window.__kovesh.me.id)", 5000)
        R['guest_sees_trap'] = True
        R['guest_button_hidden'] = ev(guest, "document.getElementById('itemBtn').classList.contains('hidden')")
        # 3) 💣 ברווח: המארח יוצר, האורח רואה ספירה ואז פיצוץ
        ev(host, "(id)=>{window.__kovesh.game.players[id-1].item='bomb'}", gid)
        wait(guest, "window.__kovesh.me.item==='bomb'", 5000)
        ev(guest, "window.__boomSeen=0; window.__bt=setInterval(()=>{ if (window.__kovesh.booms.length) window.__boomSeen=1; }, 30)")
        guest.keyboard.press('Space')
        wait(host, "window.__kovesh.items.list.some(i=>i.k==='bomb')", 5000)
        # המארח "בורח" עם האורח: מזיזים אותו 30 יחידות מהפצצה (עדיין קפוא) – הפיצוץ לא יפגע בו
        ev(host, "(id)=>{const g=window.__kovesh.game,q=g.players[id-1];q.x=q.px=g.wrap(q.x+30);}", gid)
        wait(guest, "window.__kovesh.items.list.some(i=>i.k==='bomb')", 5000)
        R['guest_countdown_s'] = ev(guest, "(()=>{const k=window.__kovesh,b=k.items.list.find(i=>i.k==='bomb');return Math.ceil(window.Items.left(b,0,performance.now()))})()")
        wait(host, "!window.__kovesh.items.list.some(i=>i.k==='bomb')", 6000)
        wait(guest, "!window.__kovesh.items.list.some(i=>i.k==='bomb') && window.__boomSeen", 4000)
        R['guest_saw_boom'] = True
        R['errors'] = errors
        b.close()
finally:
    srv.terminate()
print(json.dumps(R, ensure_ascii=False, indent=1))
ok = (not errors and R.get('guest_lobby_shows_traps_on') and R.get('guest_cannot_change') and R.get('itemsOn_both') == [True, True] and R.get('guest_button') == '🪤'
      and R.get('host_trap_owner_is_guest') and R.get('host_slot_cleared') and R.get('guest_sees_trap') and R.get('guest_button_hidden')
      and R.get('guest_countdown_s') in (1, 2, 3) and R.get('guest_saw_boom'))
print('PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
