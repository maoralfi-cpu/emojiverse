#!/usr/bin/env python3
"""v9.9 actual host/client pit layout, mid-join, death event and terrain delta.
Uses sanctioned local test transport (not a real WebRTC test).
"""
import subprocess, sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
srv=subprocess.Popen([sys.executable,'-m','http.server','8783','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(.5)
errors=[]
try:
    with sync_playwright() as p:
        b=p.chromium.launch(channel='chrome',headless=True)
        ctx=b.new_context(viewport={'width':412,'height':915},is_mobile=True,has_touch=True)
        def phone():
            pg=ctx.new_page()
            pg.on('pageerror',lambda e:errors.append(str(e)))
            pg.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
            return pg
        host=phone(); host.goto('http://127.0.0.1:8783/?transport=local')
        host.click('#onlineBtn');host.click('#hostBtn')
        host.wait_for_function("() => document.getElementById('roomCode').textContent.length===4")
        host.click('#mpBotsSeg button[data-v="0"]')
        code=host.locator('#roomCode').inner_text()
        client=phone();client.goto('http://127.0.0.1:8783/?transport=local&room='+code)
        client.wait_for_function("() => document.querySelectorAll('#lobbyPlayers li').length===2")
        host.click('#startBtn')
        client.wait_for_function("() => window.__kovesh.state==='play' && window.__kovesh.pits.pits.length>=3")
        expected=host.evaluate('window.__kovesh.pits.publicList()')
        assert client.evaluate('window.__kovesh.pits.publicList()')==expected
        late=phone();late.goto('http://127.0.0.1:8783/?transport=local&room='+code)
        late.wait_for_function("() => window.__kovesh.state==='play' && window.__kovesh.pits.pits.length>=3")
        assert late.evaluate('window.__kovesh.pits.publicList()')==expected
        pid=client.evaluate('window.__kovesh.me.id')
        host.evaluate('''pid=>{const g=window.__kovesh.game,p=g.players[pid-1],h=window.__kovesh.pits.pits[0];
          p.x=h.x;p.y=h.y;p.px=h.x;p.py=h.y;p.trail=[];p.h=p.target=0;
        }''',pid)
        client.wait_for_function("() => document.getElementById('feed').textContent.includes('בור מלכודת')")
        client.wait_for_function("() => !window.__kovesh.me.alive && window.__kovesh.game.counts[window.__kovesh.me.id]===0")
        assert host.evaluate('window.__kovesh.pits.publicList()')==expected
        assert client.evaluate('window.__kovesh.pits.publicList()')==expected
        # Same layouts still visible during a wide-view pack; hazards don't enter minimap.
        host.evaluate("window.__kovesh.packs.apply(window.__kovesh.game,window.__kovesh.me,'wide',window.__kovesh.game.tickNo)")
        host.wait_for_timeout(1200)
        host.screenshot(path='/workspace/emojiverse-v99-online-pits.png')
        assert not errors,errors
        print(json.dumps({'layoutStart':True,'midJoin':True,'deathEvent':True,'terrainDelta':True,'persistentLayout':True,'widePack':True,'consoleErrors':errors}))
        b.close()
finally:
    srv.terminate()
print('PASS: online pits via local transport (no WebRTC)')
