/* v9.21 מצב מלכודת (סעיף 23): 🪤 מלכודת ו־💣 פצצה – לוגיקה בלי DOM */
const assert = require('assert');
const Game = require('../js/game');
const Packs = require('../js/packs');
const Items = require('../js/items');
const AI = require('../js/ai');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓ ' + name); }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function fixture() {
  const g = new Game({ size: 100, rand: seeded(7) });
  const a = g.addPlayer({ name: 'A' }), b = g.addPlayer({ name: 'B', isBot: true });
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  const items = new Items(); g.itemSystem = items;
  return { g, a, b, items };
}
function steps(g, n) { for (let i = 0; i < n; i++) g.step(); }

test('בלי מצב מלכודת: המאגר = 8 הפתעות בלבד', () => {
  const pk = new Packs(); pk.reset();
  assert.equal(pk.pool().length, 8); assert(!pk.pool().includes('trap'));
});
test('במצב מלכודת: 10 סוגים בסיכוי שווה, כולל 🪤 ו־💣', () => {
  const pk = new Packs({ rand: seeded(3) }); pk.reset(); pk.setItems(true);
  assert.equal(pk.pool().length, 10);
  const g = new Game({ size: 130, rand: seeded(1) }); g.addPlayer({}); g.spawn(g.players[0], { x: 5, y: 5 });
  const cnt = {};
  for (let i = 0; i < 20000; i++) { pk.packs.length = 0; const p = pk.spawnOne(g, { x: 50, y: 50 }); cnt[p.effectId] = (cnt[p.effectId] || 0) + 1; }
  assert.equal(Object.keys(cnt).length, 10);
  for (const k in cnt) assert(Math.abs(cnt[k] - 2000) < 300, k + ' ' + cnt[k]);
});
test('איסוף פריט: נכנס לתא, לא מפעיל אפקט, ומחליף פריט קודם', () => {
  const { g, a } = fixture(); const pk = new Packs(); pk.reset(); pk.setItems(true);
  pk.packs.push({ id: 1, x: a.x, y: a.y, effectId: 'trap' });
  pk.tick(g); assert.equal(a.item, 'trap'); assert.equal(pk.activeOf(a.id), null);
  assert(pk.events.some(e => e.type === 'pick' && e.effectId === 'trap'));
  pk.packs.push({ id: 2, x: a.x, y: a.y, effectId: 'bomb' }); pk.tick(g); assert.equal(a.item, 'bomb');
});
test('איסוף פריט לא מבטל אפקט פעיל', () => {
  const { g, a } = fixture(); const pk = new Packs(); pk.reset(); pk.setItems(true);
  pk.apply(g, a, 'speed', g.tickNo);
  pk.packs.push({ id: 1, x: a.x, y: a.y, effectId: 'bomb' }); pk.tick(g);
  assert.equal(pk.activeOf(a.id).effectId, 'speed'); assert.equal(a.item, 'bomb');
});
test('הטלה: במיקום הראש, התא מתרוקן; בלי פריט – כלום', () => {
  const { g, a, items } = fixture();
  assert.equal(items.drop(g, a), null);
  a.item = 'trap'; const it = items.drop(g, a);
  assert(it && it.k === 'trap' && Math.abs(it.x - a.x) < 1e-9 && it.o === a.id); assert.equal(a.item, null);
});
test('🪤 יריב שנכנס נקפא 2 שנ׳ (בלי תנועה ובלי פנייה), השובל נשאר, המלכודת נעלמת', () => {
  const { g, a, b, items } = fixture();
  a.item = 'trap'; items.drop(g, a);
  const t = items.list[0]; t.x = 70; t.y = 60;   // מזיזים את המלכודת לדרכו של B
  b.h = b.target = 0; b.trail = [];
  let frozeAt = -1;
  for (let i = 0; i < 120 && frozeAt < 0; i++) { g.step(); if (Items.frozen(b, g.tickNo)) frozeAt = g.tickNo; }
  assert(frozeAt > 0, 'B לא נקפא'); assert.equal(items.list.length, 0);
  assert(items.events.some(e => e.type === 'snap' && e.playerId === b.id && e.ownerId === a.id));
  const x = b.x, y = b.y, h = b.h, tl = b.trail.length; b.target = 2;
  steps(g, Items.FREEZE_TICKS - 2);
  assert.equal(b.x, x); assert.equal(b.y, y); assert.equal(b.h, h); assert.equal(b.trail.length, tl);
  assert(b.alive && tl > 0, 'השובל פתוח');
  steps(g, 5); assert(!Items.frozen(b, g.tickNo)); assert(b.x !== x || b.y !== y);
});
test('🪤 הבעלים חסין; מלכודת פגה אחרי 30 שנ׳', () => {
  const { g, a, items } = fixture();
  a.item = 'trap'; items.drop(g, a); a.h = a.target = 0;
  steps(g, 30); assert(!Items.frozen(a, g.tickNo)); assert.equal(items.list.length, 1);
  a.x = 20; a.y = 20; a.h = a.target = Math.PI / 2;
  steps(g, Items.TRAP_TICKS); assert.equal(items.list.length, 0);
  assert(items.events.some(e => e.type === 'expire'));
});
test('💣 מתפוצץ אחרי 3 שנ׳: ראש ברדיוס נפסל (bomb, קרדיט לבעלים), שטח יריב ניטרלי, שטח הבעלים נשאר', () => {
  const { g, a, b, items } = fixture();
  b.x = 40; b.y = 20; b.px = b.x; b.py = b.y; b.frozenUntil = 1e9;   // B עומד במקום (קפוא) ליד הפצצה
  // שטח של B ליד הפצצה ושל A בתוכה
  g.stamp(41, 21, 2, b.id, false); const ownA = g.counts[a.id];
  a.item = 'bomb'; a.x = 40; a.y = 20; const bomb = items.drop(g, a);
  a.x = 10; a.y = 80; a.frozenUntil = 1e9;   // A ברח (מחוץ לרדיוס)
  steps(g, Items.FUSE_TICKS - 1); assert(b.alive, 'לפני הפיצוץ');
  g.events.length = 0; steps(g, 1);
  assert(!b.alive); const d = g.events.find(e => e.type === 'death' && e.victim === b);
  assert(d && d.reason === 'bomb' && d.killer === a); assert.equal(a.kills, 1);
  assert(a.alive); assert.equal(g.counts[a.id], ownA);
  assert(items.events.some(e => e.type === 'boom' && e.victims.includes(b.id)));
  assert.equal(items.list.length, 0); assert(bomb);
});
test('💣 פיצוץ מנטרל שטח יריב ברדיוס גם בלי פגיעה בראש', () => {
  const { g, a, b, items } = fixture();
  g.stamp(80, 80, 3, b.id, false); const before = g.counts[b.id];
  a.item = 'bomb'; a.x = 80.2; a.y = 80.2; items.drop(g, a); a.x = 20; a.y = 20; a.frozenUntil = 1e9; b.frozenUntil = 1e9;
  steps(g, Items.FUSE_TICKS);
  assert(b.alive); assert(g.counts[b.id] < before); assert.equal(g.ownerAt(80, 80), 0);
});
test('💣 המטיל עצמו נפסל אם לא ברח – בלי קרדיט הריגה', () => {
  const { g, a, items } = fixture();
  a.item = 'bomb'; items.drop(g, a); a.frozenUntil = 1e9;
  steps(g, Items.FUSE_TICKS);
  assert(!a.alive); const d = g.events.find(e => e.type === 'death' && e.victim === a);
  assert(d && d.reason === 'bomb' && !d.killer); assert.equal(a.kills, 0);
});
test('מוות מנקה פריט ביד וקפיאה', () => {
  const { g, a } = fixture(); a.item = 'bomb'; a.frozenUntil = 99; g.kill(a, null, 'self');
  assert.equal(a.item, null); assert.equal(a.frozenUntil, 0);
});
test('בוט: מטיל פצצה כשיריב קרוב ובורח ממנה', () => {
  const { g, a, b, items } = fixture();
  b.x = 22; b.y = 20; b.item = 'bomb';
  AI.think(g, b, 'normal'); assert.equal(b.item, null); assert.equal(items.list.length, 1);
  const bomb = items.list[0], ang = b.target;
  const away = Math.atan2(-g.wd(bomb.y - b.y), -g.wd(bomb.x - b.x));
  // הבוט על הפצצה עצמה – כל כיוון בורח; בודקים מצב שבו הוא קצת לצד
  b.x = bomb.x + 1; b.y = bomb.y; AI.think(g, b, 'normal');
  assert(Math.abs(Game.angDiff(b.target, 0)) < 0.8, 'בורח הרחק מהפצצה ' + b.target);
  assert(isFinite(ang) && isFinite(away));
});
test('בוט נמנע ממלכודת של אחר (כמו מבור)', () => {
  const { g, a, b, items } = fixture();
  items.list.push({ id: 9, k: 'trap', x: 63, y: 60, o: a.id, until: 1e9 });
  assert(items.dangerAt(g, b, 63, 60, 1.4)); assert(!items.dangerAt(g, a, 63, 60, 1.4));
});
test('סנכרון רשת: netState → applyNet משחזר פריטים, ידיים וקפיאה', () => {
  const { g, a, b, items } = fixture();
  a.item = 'bomb'; items.drop(g, a); b.item = 'trap'; b.frozenUntil = g.tickNo + 60;
  const ns = items.netState(g);
  const g2 = new Game({ size: 100 }); g2.addPlayer({}); g2.addPlayer({});
  const c = new Items(); c.applyNet(g2, JSON.parse(JSON.stringify(ns.msg)), 1000, 1000 / 60);
  assert.equal(c.list.length, 1); assert.equal(c.list[0].k, 'bomb'); assert(Math.abs(c.list[0].atMs - 1000 - 3000) < 20);
  assert.equal(g2.players[1].item, 'trap'); assert(g2.players[1].frozenMs > 1000);
  assert.equal(g2.players[0].item, null);
  const k1 = ns.key; g.step(); assert.equal(items.netState(g).key, k1, 'key יציב כשלא השתנה דבר');
});
test('השחקן במצב מהיר: הבורות/מלכודות נבדקים במקטע (אין מנהור)', () => {
  const g = new Game({ size: 100, speed: 600, rand: seeded(5) });
  const a = g.addPlayer({}), b = g.addPlayer({}); g.spawn(a, { x: 80, y: 80 }); g.spawn(b, { x: 10, y: 10 });
  const items = new Items(); g.itemSystem = items;
  items.list.push({ id: 1, k: 'trap', x: 15, y: 10, o: a.id, until: 1e9 });
  b.h = b.target = 0; g.step(); assert(Items.frozen(b, g.tickNo));
});
console.log('\n' + checks + ' בדיקות מצב מלכודת עברו');
