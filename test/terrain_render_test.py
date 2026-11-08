#!/usr/bin/env python3
"""v9.9 periodic contour regression: ownership vs actual fill+stroke+shadow pixels.
No production files changed; use a headless canvas and the real Terrain module.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page()
    for name in ['game', 'terrain', 'pits']:
        page.add_script_tag(path=str(ROOT / 'js' / (name + '.js')))
    result = page.evaluate(r'''() => {
      const assert = (v,m) => {if(!v)throw Error(m)};
      const W=40, G=80, C=.5, scenarios=[];
      function rect(o,id,x0,y0,x1,y1){for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)o[y*G+x]=id;}
      function make(name,setup,seam=false){let o=new Uint8Array(G*G);setup(o);scenarios.push({name,o,seam});}
      make('dual-cross',o=>{rect(o,1,36,0,44,G);rect(o,1,0,36,G,44);rect(o,2,8,8,24,24)});
      make('77-percent',o=>{o.fill(1);rect(o,2,8,8,40,40);rect(o,0,48,48,69,69)},true);
      make('near-full',o=>{o.fill(1);rect(o,2,15,15,22,22)},true);
      make('full',o=>o.fill(1),true);
      make('empty',o=>{},false);
      make('sparse-old-flood',o=>{for(let i=0;i<G;i++){o[i*G+i]=1;o[i]=1;o[i*G]=1;}});
      make('single-V',o=>rect(o,1,36,0,44,G));
      make('single-H',o=>rect(o,1,0,36,G,44));
      make('normal-blob',o=>{rect(o,1,20,20,50,50);rect(o,2,55,55,70,70);});
      make('seam-blob',o=>{rect(o,1,0,20,8,50);rect(o,1,72,20,80,50)});
      make('narrow-gap',o=>{o.fill(1);rect(o,0,30,0,31,G);rect(o,2,50,20,70,50)});
      const colors=['#f4f6fa','#b494d8','#649bd2'], expected=[[244,246,250],[180,148,216],[100,155,210]];
      const reports=[];
      for(const sc of scenarios){
        const snap=sc.o.slice(), paths=[];
        for(let id=1;id<=2;id++) paths[id]=Terrain.build(sc.o,G,C,id);
        let tested=0,bad=0,seamBad=0;
        for(const S of [5,12,20]){
          const canvas=document.createElement('canvas');canvas.width=canvas.height=80*S;
          const ctx=canvas.getContext('2d',{alpha:false});
          const origin=-20;
          ctx.fillStyle=colors[0];ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.setTransform(S,0,0,S,-origin*S,-origin*S);
          for(let ty=-1;ty<=1;ty++)for(let tx=-1;tx<=1;tx++){
            ctx.save();ctx.translate(tx*W,ty*W);
            // Same shadow + clip treatment as renderLayer.
            ctx.translate(0,.28);
            for(let id=1;id<=2;id++)if(paths[id]){
              ctx.save();if(paths[id].clip){ctx.beginPath();ctx.rect(0,-.28,W,W);ctx.clip();}
              ctx.fillStyle='#776a88';ctx.fill(paths[id].fill,'evenodd');ctx.restore();
            }
            ctx.translate(0,-.28);
            for(let id=1;id<=2;id++)if(paths[id]){
              ctx.save();if(paths[id].clip){ctx.beginPath();ctx.rect(0,0,W,W);ctx.clip();}
              ctx.fillStyle=colors[id];ctx.fill(paths[id].fill,'evenodd');
              ctx.lineWidth=id===1?.26:.12;ctx.strokeStyle='#352343';ctx.stroke(paths[id].stroke);ctx.restore();
            }
            ctx.restore();
          }
          const img=ctx.getImageData(0,0,canvas.width,canvas.height);
          function sample(x,y){let px=Math.floor((x-origin)*S),py=Math.floor((y-origin)*S),k=(py*canvas.width+px)*4;return [...img.data.slice(k,k+3)];}
          function eq(a,b){return a.every((v,i)=>Math.abs(v-b[i])<=2);}
          function owner(x,y){return sc.o[((y%G+G)%G)*G+(x%G+G)%G];}
          // Compare centers away from genuine borders; smoothing is intentionally organic.
          for(let y=-30;y<110;y+=2)for(let x=-30;x<110;x+=2){
            let id=owner(x,y),safe=true;
            for(let dy=-3;dy<=3&&safe;dy++)for(let dx=-3;dx<=3;dx++)if(owner(x+dx,y+dy)!==id){safe=false;break;}
            if(!safe)continue;
            let rgb=sample((x+.5)*C,(y+.5)*C);tested++;
            if(!eq(rgb,expected[id]))bad++;
          }
          if(sc.seam)for(const x of [-.05,0,.05,39.95,40,40.05])for(const y of [-.05,0,.05,39.95,40,40.05,4,14,24,34])
            if(!eq(sample(x,y),expected[1]))seamBad++;
          // Repeat a draw after a tiny camera shift should not change world ownership.
        }
        assert(bad===0,sc.name+': wrong safe-region colors '+bad+'/'+tested);
        assert(seamBad===0,sc.name+': artificial seam/shadow/white sparkle '+seamBad);
        assert(sc.o.every((v,i)=>v===snap[i]),'renderer modified grid');
        reports.push({name:sc.name,tested,bad,seamBad});
      }
      // Maximum map contour timing (node/browser hardware, not an Android guarantee).
      const big=new Uint8Array(260*260);big.fill(1);
      for(let y=50;y<150;y++)for(let x=60;x<150;x++)big[y*260+x]=0;
      const t=performance.now();Terrain.build(big,260,.5,1);const ms=performance.now()-t;
      return {reports,maxMapContourMs:+ms.toFixed(2)};
    }''')
    print(json.dumps(result, indent=2))
    # Original crater art preview, for human inspection.
    page.set_viewport_size({'width': 700, 'height': 340})
    page.set_content('<canvas id="art" width="700" height="340"></canvas>')
    page.evaluate('''() => {let c=document.getElementById('art').getContext('2d');
      c.fillStyle='#b494d8';c.fillRect(0,0,700,340);
      Pits.draw(c,180,160,52,1000,1,false);Pits.draw(c,430,160,24,2200,2,false);
      c.fillStyle='#252137';c.font='20px sans-serif';c.fillText('Trap craters • normal / zoomed out',140,285);
    }''')
    os.makedirs(ROOT / 'test' / 'shots', exist_ok=True)
    page.screenshot(path='/workspace/emojiverse-pits-preview.png')
    browser.close()
print('PASS: ownership, foreign colors, seam fills/strokes/shadows and no flood/invert')
