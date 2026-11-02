"""בדיקת ממשחק אונליין אמיתית: כמה דפדפנים בתצוגת טלפון, דרך שרת התיאום הציבורי של PeerJS.
הרצה: tools/.venv/bin/python test/mp_test.py [URL]
תרחיש א: מארח + 2 מצטרפים + 2 בוטים. תרחיש ב: 2 בני אדם בלי בוטים."""
import sys, os, json, time, math, subprocess
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
url = args[0] if args else None
LOCAL = '--local' in sys.argv   # צינור מקומי במקום WebRTC (כשהסביבה חוסמת WebRTC)
Q = ('transport=local&' if LOCAL else '')
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8771'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8771/'
R = {}; errors = []
CX, CY = 206, 457.5

SHARED = {}
def phone(b, name):
    if LOCAL:   # BroadcastChannel עובד רק בתוך אותו הקשר דפדפן
        if 'ctx' not in SHARED:
            SHARED['ctx'] = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx = SHARED['ctx']
    else:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.add_init_script("if(!sessionStorage.getItem('n')){sessionStorage.setItem('n','1');localStorage.setItem('kovesh.settings', JSON.stringify({name:'%s', v:4, avatar:0}))}" % name)
    class C:
        def close(self_inner): pg.close() if LOCAL else ctx.close()
    ctx = C()
    pg.on('pageerror', lambda e: errors.append(name + ': ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'Content Security Policy' not in m.text and errors.append(name + ': ' + m.text))
    return ctx, pg

def ev(pg, js): return pg.evaluate(js)
def wait(pg, js, ms=20000):
    t0 = time.time()
    while True:
        try:
            if pg.evaluate('()=>{try{return !!(' + js + ')}catch(e){return false}}'): return
        except Exception: pass
        if (time.time() - t0) * 1000 > ms: raise TimeoutError('wait: ' + js[:90] + ' | ' + str(pg.evaluate("document.getElementById('onlineMsg').textContent")))
        pg.wait_for_timeout(100)

def open_room(host, bots, minutes=None):
    host.goto(url + ('?' + Q if Q else '')); host.click('#onlineBtn'); host.click('#hostBtn')
    wait(host, "document.getElementById('roomCode').textContent.length===4 && !document.getElementById('lobby').classList.contains('hidden')")
    host.click('#mpBotsSeg button[data-v="%d"]' % bots)
    if minutes: ev(host, "window.__koveshNet.setCfg({minutes:%s})" % minutes)
    return ev(host, "document.getElementById('roomCode').textContent")

def join(pg, code, n):
    pg.goto(url + '?' + Q + 'room=' + code)   # קישור השיתוף מצטרף ישר
    wait(pg, "!document.getElementById('lobby').classList.contains('hidden') && document.querySelectorAll('#lobbyPlayers li').length>=%d" % n, 30000)

def state(pg): return ev(pg, "(()=>{const k=window.__kovesh,g=k.game;if(!g)return null;return {st:k.state,me:k.me.id,n:g.players.length,players:g.players.map(p=>({id:p.id,name:p.name,alive:p.alive,gone:!!p.gone,x:+p.x.toFixed(2),y:+p.y.toFixed(2),c:g.counts[p.id],kills:p.kills}))}})()")

def capture_loop(pg, hostpg, ms=700, tries=4):
    # יציאה ולולאה; אם השחקן נפסל (קיר/בוט) – מחכים שיחזור ומנסים שוב. מחזיר (במארח, אצל השחקן)
    pid = ev(pg, 'window.__kovesh.me.id')
    for t in range(tries):
        wait(hostpg, 'window.__kovesh.game.players[%d].alive' % (pid - 1), 8000)
        # קודם לכיוון מרכז המפה, כדי לא לפגוע בקיר
        x, y, W = ev(pg, "[window.__kovesh.me.x, window.__kovesh.me.y, window.__kovesh.game.W]")
        a = math.atan2(W / 2 - y, W / 2 - x)
        steer_square(pg, ms, hostpg, a)
        pg.wait_for_timeout(400)
        h = ev(hostpg, 'window.__kovesh.game.counts[%d]' % pid); c = ev(pg, 'window.__kovesh.game.counts[%d]' % pid)
        if h > 160: return h, c
    return h, c

def steer_square(pg, ms=700, hostpg=None, a0=0.0):
    for k in range(3):
        a = a0 + k * math.pi / 2
        pg.touchscreen.tap(CX + math.cos(a) * 120, CY + math.sin(a) * 120); pg.wait_for_timeout(ms)
    # חזרה הביתה בנגיעות לכיוון השטח (נקודת הבית ידועה רק במארח)
    hostpg = hostpg or pg
    pid = ev(pg, 'window.__kovesh.me.id')
    for i in range(30):
        st = ev(hostpg, "(()=>{const p=window.__kovesh.game.players[%d];return [p.homeX,p.homeY,p.trail.length,p.alive]})()" % (pid - 1))
        if os.environ.get("DBG"): print("home", i, st, ev(pg, "[window.__kovesh.me.x, window.__kovesh.me.y, window.__kovesh.game.counts[window.__kovesh.me.id]]"))
        if not st[3] or (i > 0 and st[2] == 0): break
        x, y = ev(pg, "[window.__kovesh.me.x, window.__kovesh.me.y]")
        a = math.atan2(st[1] - y, st[0] - x)
        pg.touchscreen.tap(CX + math.cos(a) * 120, CY + math.sin(a) * 120); pg.wait_for_timeout(150)

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=['--disable-features=WebRtcHideLocalIpsWithMdns'])  # בקונטיינר אין mDNS; בטלפונים אמיתיים אין צורך
    # ---------- תרחיש א: 3 טלפונים + 2 בוטים ----------
    hc, host = phone(b, 'אבא'); c1c, c1 = phone(b, 'נועה'); c2c, c2 = phone(b, 'איתי')
    code = open_room(host, 2, 0.5)
    R['room_code'] = code
    join(c1, code, 2); join(c2, code, 3)
    wait(host, "document.querySelectorAll('#lobbyPlayers li').length===3")
    # אימוג'י: נועה בוחרת 🦊 => אצל איתי הוא מושבת; איתי בוחר 🐸 => המארח רואה; המארח נשאר על 🎲 אקראי
    c1.click('#lobbyAvatars button[data-e="🦊"]'); c1.wait_for_timeout(700)
    R['taken_avatar_disabled'] = ev(c2, "document.querySelector('#lobbyAvatars button[data-e=\"🦊\"]').disabled") is True
    c2.click('#lobbyAvatars button[data-e="🐸"]'); c2.wait_for_timeout(700)
    R['avatar_pick_synced'] = '🐸איתי' in ev(host, "document.getElementById('lobbyPlayers').textContent").replace(' ', '')
    R['host_random_default'] = ev(host, "document.querySelector('#lobbyAvatars button.on').dataset.e") == ''
    R['client_sees_bots_cfg'] = ev(c1, "document.querySelector('#mpBotsSeg button.on').dataset.v") == '2'
    host.screenshot(path=os.path.join(ROOT, 'test', 'lobby.png'))
    host.click('#startBtn')
    for pg in (c1, c2): wait(pg, "window.__kovesh.state==='play' && window.__kovesh.game && window.__kovesh.game.players.some(p=>p.alive)")
    hs = state(host); s1 = state(c1)
    R['roster'] = [pp['name'] for pp in hs['players']]
    emos = ev(host, "window.__kovesh.game.players.map(p=>p.emoji)")
    R['emojis'] = emos
    R['emojis_unique_and_picked'] = len(set(emos)) == len(emos) and emos[1] == '🦊' and emos[2] == '🐸' and ev(c1, "window.__kovesh.game.players.map(p=>p.emoji).join()") == ','.join(emos)
    R['players_total_ok'] = hs['n'] == 5 and s1['n'] == 5
    # תנועה: נגיעה אצל נועה => הכיוון במארח משתנה
    c1.touchscreen.tap(CX - 150, CY); c1.wait_for_timeout(300)
    tgt = ev(host, "window.__kovesh.game.players[%d].target" % (s1['me'] - 1))
    R['client_input_reaches_host'] = abs(abs(tgt) - math.pi) < 0.05
    def cells(pg, pid): return ev(pg, 'window.__kovesh.game.counts[%d]' % pid)
    s2 = state(c2)
    h1, v1 = capture_loop(c1, host); cap1 = (h1, v1, cells(c2, s1['me']))
    h2, v2 = capture_loop(c2, host, 650); cap2 = (h2, v2, cells(c1, s2['me']))
    R['captures_host_c1view_c2view'] = [cap1, cap2]
    # סנכרון: מיקום ושטח במארח מול אצל כל לקוח
    def wdel(d, W):
        d = d % W
        return d - W if d > W / 2 else d
    def compare_once(cl):
        a = state(host); bb = state(cl)
        W = ev(host, 'window.__kovesh.game.W')
        # v8: הפרש עטוף (טורוס) – אחרת שחקן שעומד על התפר נראה "רחוק" 80 יחידות (זה היה מקור הכישלון האקראי)
        dpos = max(math.hypot(wdel(x['x'] - y['x'], W), wdel(x['y'] - y['y'], W)) for x, y in zip(a['players'], bb['players']) if x['alive'] and y['alive'])
        dcnt = max(abs(x['c'] - y['c']) for x, y in zip(a['players'], bb['players']))
        return round(dpos, 2), dcnt, a
    def compare(cl):
        # שתי קריאות נפרדות (מארח, ואז לקוח) לא באותו רגע: כיבוש או פסילה של בוט בדיוק ביניהן נותנים פער רגעי.
        # לוקחים את הטובה מבין 3 מדידות
        best = None
        for _ in range(3):
            r = compare_once(cl)
            if best is None or (r[0], r[1]) < (best[0], best[1]): best = r
            if r[0] < 2.5 and r[1] < 60: break
            cl.wait_for_timeout(250)
        return best
    d1 = compare(c1); d2 = compare(c2)
    R['sync_pos_max_units'] = [d1[0], d2[0]]
    R['sync_cells_max_diff'] = [d1[1], d2[1]]
    R['sync_ok'] = d1[0] < 2.5 and d2[0] < 2.5 and d1[1] < 60 and d2[1] < 60 and all(c[0] > 160 and abs(c[0] - c[1]) < 60 and abs(c[0] - c[2]) < 60 for c in (cap1, cap2))
    c1.screenshot(path=os.path.join(ROOT, 'test', 'mp_game.png'))
    # השהיה כשהמארח ברקע
    ev(host, "window.__kovesh.pause('bg')")
    wait(c1, "!document.getElementById('netmsg').classList.contains('hidden')", 8000)
    R['bg_pause_msg'] = ev(c1, "document.getElementById('netText').textContent")
    t1 = ev(c1, "window.__kovesh.game.players[0].x"); c1.wait_for_timeout(500); t2 = ev(c1, "window.__kovesh.game.players[0].x")
    host.click('#resumeBtn')
    wait(c1, "document.getElementById('netmsg').classList.contains('hidden')", 8000)
    R['pause_resume_ok'] = True
    # ניתוק: איתי סוגר את האפליקציה
    pid2 = state(c2)['me']
    c2c.close()
    host.wait_for_timeout(2500)
    hs = state(host)
    R['disconnect_removed'] = hs['players'][pid2 - 1]['gone'] and hs['players'][pid2 - 1]['c'] == 0
    c1.wait_for_timeout(300)
    R['disconnect_synced_to_client'] = state(c1)['players'][pid2 - 1]['c'] == 0
    # סוף סיבוב (30 שניות בבדיקה)
    wait(host, "!document.getElementById('results').classList.contains('hidden')", 40000)
    wait(c1, "!document.getElementById('results').classList.contains('hidden')", 8000)
    R['results_host'] = ev(host, "[...document.querySelectorAll('#rankList li')].map(l=>l.textContent)")
    R['results_client_same'] = ev(c1, "[...document.querySelectorAll('#rankList li')].map(l=>l.textContent)") == R['results_host']
    R['again_btn_host_only'] = ev(host, "!document.getElementById('againRoundBtn').classList.contains('hidden')") and ev(c1, "document.getElementById('againRoundBtn').classList.contains('hidden')")
    host.screenshot(path=os.path.join(ROOT, 'test', 'mp_results.png'))
    host.click('#againRoundBtn')
    wait(c1, "window.__kovesh.state==='play'", 10000)
    R['next_round_ok'] = True
    # המארח יוצא
    host.click('#pauseBtn'); host.click('#quitBtn')
    wait(c1, "!document.getElementById('netmsg').classList.contains('hidden') && document.getElementById('netTitle').textContent.includes('המארח')", 10000)
    R['host_left_msg'] = ev(c1, "document.getElementById('netTitle').textContent")
    hc.close(); c1c.close()

    # ---------- תרחיש ב: 2 בני אדם, בלי בוטים ----------
    hc, host = phone(b, 'אמא'); jc, j = phone(b, 'דני')
    code = open_room(host, 0, 0.4)
    join(j, code, 2)
    R['nobots_cfg_on_client'] = ev(j, "document.querySelector('#mpBotsSeg button.on').textContent")
    host.click('#startBtn')
    wait(j, "window.__kovesh.state==='play' && window.__kovesh.game.players.every(p=>p.alive)")
    cj = capture_loop(j, host)
    hh = capture_loop(host, host); ch = (hh[0], ev(j, 'window.__kovesh.game.counts[1]'))
    a = state(host); bb = state(j)
    R['nobots_players'] = [pp['name'] for pp in a['players']]
    R['nobots_captures_host_vs_client'] = {'דני': cj, 'אמא': ch}
    R['nobots_ok'] = a['n'] == 2 and bb['n'] == 2 and all(c[0] > 160 and abs(c[0] - c[1]) < 60 for c in (cj, ch))
    wait(j, "!document.getElementById('results').classList.contains('hidden')", 40000)
    R['nobots_results'] = ev(j, "[...document.querySelectorAll('#rankList li')].map(l=>l.textContent)")
    hc.close(); jc.close()
    # חד-שחקן לא נוגע ברשת
    sc, s = phone(b, 'solo'); reqs = []
    s.on('request', lambda r: reqs.append(r.url))
    s.goto(url); s.click('#playBtn'); s.wait_for_timeout(1500)
    R['solo_no_network'] = not [u for u in reqs if 'peerjs' in u]
    b.close()
if srv: srv.kill()
R['console_errors'] = errors
print(json.dumps(R, ensure_ascii=False, indent=1))
keys = ['emojis_unique_and_picked', 'host_random_default', 'taken_avatar_disabled', 'avatar_pick_synced', 'client_sees_bots_cfg', 'players_total_ok', 'client_input_reaches_host', 'sync_ok', 'pause_resume_ok', 'disconnect_removed', 'disconnect_synced_to_client', 'results_client_same', 'again_btn_host_only', 'next_round_ok', 'nobots_ok', 'solo_no_network']
bad = [k for k in keys if not R.get(k)]
print('PASS' if not bad and not errors else 'FAIL ' + ','.join(bad))
