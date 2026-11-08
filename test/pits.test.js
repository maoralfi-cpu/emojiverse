const assert = require('assert');
const Game = require('../js/game');
const Pits = require('../js/pits');
const Packs = require('../js/packs');
const AI = require('../js/ai');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓ ' + name); }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function fixture(W = 100, speed = 9.75) {
  const g = new Game({ size: W, speed, rand: seeded(42) });
  const p = g.addPlayer({ isBot: false }); g.spawn(p, { x: 10, y: 10 });
  const pits = new Pits(); g.pitSystem = pits;
  return {g, p, pits};
}
test('contact on owned land eliminates with pit event, no kill awarded', () => {
  const {g,p,pits} = fixture(); pits.applySync(g, [{x: 10, y:10}]);
  p.h = p.target = 0; g.step();
  assert(!p.alive); assert.equal(g.counts[p.id], 0);
  assert(g.events.some(e => e.type === 'death' && e.reason === 'pit' && !e.killer));
});
test('high speed sweep cannot tunnel through crater', () => {
  const {g,p,pits} = fixture(100, 600); pits.applySync(g, [{x:15,y:10}]);
  p.h = p.target = 0; g.step(); assert(!p.alive);
});
test('horizontal wrap collision', () => {
  const {g,p,pits} = fixture(100, 180); pits.applySync(g, [{x:0,y:10}]);
  p.x = 98; p.y = 10; p.h = p.target = 0; g.step(); assert(!p.alive);
});
test('vertical wrap collision', () => {
  const {g,p,pits} = fixture(100, 180); pits.applySync(g, [{x:10,y:0}]);
  p.x = 10; p.y = 98; p.h = p.target = Math.PI/2; g.step(); assert(!p.alive);
});
test('near miss survives, no long chord across seam', () => {
  const {g,p,pits} = fixture(100, 180); pits.applySync(g, [{x:50,y:10}]);
  p.x = 98; p.y = 10; p.h = p.target = 0; g.step(); assert(p.alive);
});
test('pit death prevents closing trail/capturing same tick', () => {
  const {g,p,pits} = fixture(); pits.applySync(g,[{x:10,y:10}]);
  p.trail=[6,10,7,11,8,11,9,10]; p.h=p.target=0;
  g.step(); assert(!p.alive); assert(!g.events.some(e=>e.type==='capture'));
});
test('persistent hazard survives repaint, repeated contact still lethal', () => {
  const {g,p,pits} = fixture(); pits.applySync(g,[{x:50,y:50}]);
  g.stamp(50,50,3,p.id); assert(pits.dangerAt(g,50,50));
  assert.equal(pits.pits.length,1); assert(g.ownerAt(50,50)===p.id);
});
test('seed density, pack/player spacing and pit separation on all map sizes', () => {
  for (const W of [80,100,130]) {
    const {g,p,pits}=fixture(W); const packs=new Packs({rand:seeded(9)});
    packs.spawnOne(g,{x:40,y:40}); pits.seed(g,packs);
    assert.equal(pits.pits.length,Pits.maxFor(W));
    for (const h of pits.pits) {
      assert(g.dist2(p.x,p.y,h.x,h.y)>=64);
      assert(g.dist2(40,40,h.x,h.y)>=16);
      for (const b of pits.pits) if(b!==h) assert(g.dist2(h.x,h.y,b.x,b.y)>=144);
    }
  }
});
test('respawn hard-excludes pits, even forced and seam-adjacent spawns', () => {
  const {g,p,pits}=fixture(); pits.applySync(g,[{x:0,y:0}]);
  const before=g.counts[p.id];
  assert(!g.spawn(p,{x:99,y:1})); assert.equal(g.counts[p.id],before);
  for(let i=0;i<20;i++) { const at=g.findSpawn(p.id); assert(at); assert(!pits.dangerAt(g,at.x,at.y,g.SPAWN_R+3)); }
});
test('future surprise packs avoid crater area', () => {
  const {g,pits}=fixture(); pits.applySync(g,[{x:50,y:50}]);
  const packs=new Packs({rand:()=>0.5}); assert.equal(packs.findPos(g),null);
});
test('AI steers away from pit in forward lookahead', () => {
  const {g,p,pits}=fixture(); pits.applySync(g,[{x:14,y:10}]);
  p.isBot=true; p.h=p.target=0; p.ai={mode:'home',homeT:1,exitH:0,t:0};
  AI.think(g,p,'normal'); assert(Math.abs(p.target)>0.3);
});
test('layout round-trip bounded and valid, old client does no collision simulation', () => {
  const {g,pits}=fixture(); pits.seed(g,new Packs()); const before=JSON.stringify(pits.publicList());
  const client=new Pits(); client.applySync(g,JSON.parse(before)); assert.equal(JSON.stringify(client.publicList()),before);
  client.applySync(g,[{x:NaN,y:2},{x:'0',y:0},{x:101,y:-2}]);
  assert.equal(client.pits.length,1); assert.equal(client.pits[0].x,1); assert.equal(client.pits[0].y,98);
});
console.log(checks+' pit tests passed');
