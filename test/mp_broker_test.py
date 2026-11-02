"""בדיקה מול שרת התיאום הציבורי האמיתי של PeerJS (0.peerjs.com).
בודק: פתיחת חדר מקבלת קוד, קוד שגוי => הודעה ברורה, הצטרפות אמיתית ב-WebRTC.
אם הסביבה חוסמת WebRTC (כמו בקופסת הבדיקות – מדיניות Chrome disable_non_proxied_udp),
מוודא שהלקוח מקבל את הודעת השגיאה בעברית (הצעה לאותה רשת Wi-Fi) במקום להיתקע.
הרצה: tools/.venv/bin/python test/mp_broker_test.py [URL]"""
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8774'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = 'http://127.0.0.1:8774/'
R = {}; errs = []
def poll(pg, js, ms):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        if pg.evaluate('()=>{try{return !!(' + js + ')}catch(e){return false}}'): return True
        pg.wait_for_timeout(150)
    return False
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    mk = lambda: b.new_context(viewport={'width': 412, 'height': 915}, is_mobile=True, has_touch=True).new_page()
    host, c, bad = mk(), mk(), mk()
    for n, pg in (('host', host), ('client', c), ('bad', bad)): pg.on('pageerror', lambda e, n=n: errs.append(n + ': ' + str(e)))
    host.goto(url); host.click('#onlineBtn'); host.click('#hostBtn')
    R['room_opened_on_live_broker'] = poll(host, "document.getElementById('roomCode').textContent.length===4 && !document.getElementById('lobby').classList.contains('hidden')", 20000)
    code = host.evaluate("document.getElementById('roomCode').textContent"); R['code'] = code
    R['share_link'] = host.evaluate("document.getElementById('shareLink').value")
    bad.goto(url + '?room=ZZZZ')
    R['wrong_code_msg'] = poll(bad, "document.getElementById('onlineMsg').textContent.includes('לא נמצא')", 20000) and bad.evaluate("document.getElementById('onlineMsg').textContent")
    c.goto(url + '?room=' + code)
    joined = poll(c, "!document.getElementById('lobby').classList.contains('hidden')", 25000)
    R['webrtc_joined'] = joined
    if not joined:
        R['client_error_msg'] = c.evaluate("document.getElementById('onlineMsg').textContent")
        R['ice_candidates_in_this_env'] = c.evaluate("""async()=>{const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});const n=[];pc.onicecandidate=e=>e.candidate&&n.push(1);pc.createDataChannel('x');await pc.setLocalDescription(await pc.createOffer());await new Promise(r=>setTimeout(r,3000));return n.length}""")
    else:
        R['host_sees_players'] = poll(host, "document.querySelectorAll('#lobbyPlayers li').length===2", 10000)
    b.close()
if srv: srv.kill()
R['page_errors'] = errs
print(json.dumps(R, ensure_ascii=False, indent=1))
ok = R['room_opened_on_live_broker'] and R['wrong_code_msg'] and not errs and (R['webrtc_joined'] and R.get('host_sees_players') or (not R['webrtc_joined'] and 'Wi' in R.get('client_error_msg', '')))
print('PASS' + ('' if R['webrtc_joined'] else ' (WebRTC חסום בסביבה – נבדקה הודעת השגיאה)') if ok else 'FAIL')
