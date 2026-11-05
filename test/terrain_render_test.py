#!/usr/bin/env python3
"""v9.7: grid vs rendered pixels for dual-wrap cross. Exit 0 on pass."""
import json, subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = r'''<!DOCTYPE html><body><canvas id="c" width="400" height="400"></canvas>
<script src="../js/game.js"></script><script src="../js/terrain.js"></script>
<script>
(function(){
  function rect(g,id,x0,y0,x1,y1){for(var y=y0;y<y1;y+=g.CELL)for(var x=x0;x<x1;x+=g.CELL)g.setOwner(g.cellAt(x+.01,y+.01),id);}
  function painted(ctx,x,y,S){var d=ctx.getImageData(Math.floor(x*S+S/2),Math.floor(y*S+S/2),1,1).data; return d[0]<250;}
  var g=new Game({size:40}); var me=g.addPlayer({}), bot=g.addPlayer({});
  g.spawn(me,{x:20,y:20}); g.spawn(bot,{x:5,y:5});
  for(var i=0;i<g.owner.length;i++) if(g.owner[i]===me.id) g.setOwner(i,0);
  rect(g,me.id,19,0,21,40); rect(g,me.id,0,19,40,21); rect(g,bot.id,2,2,10,10);
  var path=Terrain.build(g.owner,g.G,g.CELL,me.id);
  var ctx=document.getElementById('c').getContext('2d',{alpha:false}), S=10;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,400);
  ctx.setTransform(S,0,0,S,0,0); ctx.fillStyle='#c4a8e8'; ctx.fill(path.fill,'evenodd');
  var match=0,total=0;
  for(var y=0;y<40;y++) for(var x=0;x<40;x++){
    var own=g.ownerAt(x+0.25,y+0.25)===me.id, pur=painted(ctx,x+0.25,y+0.25,S);
    total++; if(own===pur) match++;
  }
  window.__result={match:match,total:total,pct:100*match/total, botAlive:g.counts[bot.id]>0};
})();
</script></body>'''
path = os.path.join(ROOT, 'test', '_terrain_render.html')
open(path, 'w').write(html)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8781', '--bind', '127.0.0.1'],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        pg = b.new_page()
        pg.goto('http://127.0.0.1:8781/test/_terrain_render.html', wait_until='load')
        pg.wait_for_function('window.__result')
        r = pg.evaluate('window.__result')
        print(json.dumps(r))
        ok = r['pct'] >= 99.0 and r['botAlive']
        print('PASS' if ok else 'FAIL', f"{r['pct']:.1f}% match")
        sys.exit(0 if ok else 1)
finally:
    srv.terminate()
    try: os.remove(path)
    except OSError: pass
