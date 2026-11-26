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
  pk.packs.push({ id: 2, x: a.x, y: a.y, effectId: 'bomb' }); pk.tick(g); assert.equal(a.item, 'bomb'); assert.equal(a.itemN, 1);
});
test('v9.23: איסוף 🪤 נערם, הטלה מורידה אחת, תקרה 9', () => {
  const { g, a, items } = fixture(); const pk = new Packs(); pk.reset(); pk.setItems(true);
  pk.spawnCD = 1e9; pk.trapLootCD = 1e9; pk.bombLootCD = 1e9;
  pk.packs.push({ id: 1, x: a.x, y: a.y, effectId: 'trap' }); pk.tick(g);
  assert.equal(a.item, 'trap'); assert.equal(a.itemN || 1, 1);
  pk.packs.push({ id: 2, x: a.x, y: a.y, effectId: 'trap' }); pk.tick(g);
  assert.equal(a.item, 'trap'); assert.equal(a.itemN, 2);
  pk.packs.push({ id: 3, x: a.x, y: a.y, kind: 'traploot', effectId: 'trap' }); pk.tick(g);
  assert.equal(a.itemN, 3);
  const d1 = items.drop(g, a);
  assert(d1 && d1.k === 'trap'); assert.equal(a.item, 'trap'); assert.equal(a.itemN, 2);
  items.drop(g, a); items.drop(g, a);
  assert.equal(a.item, null); assert.equal(a.itemN, 0); assert.equal(items.list.length, 3);
  a.item = 'trap'; a.itemN = 9;
  pk.packs.length = 0; pk.spawnCD = 1e9; pk.trapLootCD = 1e9; pk.bombLootCD = 1e9;
  pk.packs.push({ id: 4, x: a.x, y: a.y, effectId: 'trap' }); pk.tick(g);
  assert.equal(a.itemN, 9); assert.equal(pk.packs.length, 1, 'בתקרה המלכודת נשארת על המפה');
  assert.equal(pk.packs[0].id, 4);
});
test('v9.23: מלכודות איסוף בנוסף לקופסאות, כמספר תקרת ההפתעות, ומופיעות מחדש', () => {
  const g = new Game({ size: 100, rand: seeded(2) });
  g.addPlayer({}); g.spawn(g.players[0], { x: 5, y: 5 });
  const pk = new Packs({ rand: seeded(2) }); pk.reset(); pk.setItems(true);
  assert.equal(Packs.maxFor(g.W), 2);
  const n = pk.seedTrapLoots(g);
  assert.equal(n, 2); assert.equal(pk.trapLootCount(), 2);
  assert.equal(pk.regularCount(), 0, 'לא נספרות כהפתעות');
  const box = pk.spawnOne(g, { x: 40, y: 40 });
  assert(box && pk.regularCount() === 1 && pk.trapLootCount() === 2);
  const pub = pk.publicList();
  assert(pub.filter(p => p.kind === 'traploot' && p.effectId === 'trap').length === 2, 'ברשת הסוג גלוי גם במצב רגיל');
  assert(!('effectId' in pub.find(p => p.id === box.id)), 'קופסה רגילה נשארת הפתעה');
  const loot = pk.packs.find(p => p.kind === 'traploot');
  const pl = g.players[0]; pl.x = loot.x; pl.y = loot.y;
  pk.tick(g);
  assert.equal(pl.item, 'trap'); assert.equal(pk.trapLootCount(), 1);
  pk.trapLootCD = 0;
  for (let i = 0; i < 5 && pk.trapLootCount() < 2; i++) { pk.trapLootCD = 0; pk.tick(g); }
  assert.equal(pk.trapLootCount(), 2, 'מופיעה מחדש אחרי איסוף');
  pk.reset();
  assert.equal(pk.seedTrapLoots(g), 0, 'בלי מצב מלכודת אין מלכודות איסוף');
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
test('🪤 יריב שעולה נפסל (trap, קרדיט לבעלים), המלכודת נעלמת', () => {
  const { g, a, b, items } = fixture();
  a.item = 'trap'; items.drop(g, a);
  const t = items.list[0]; t.x = 70; t.y = 60; t.arm = 0;   // מזיזים לדרכו של B, כבר מזוינת
  b.h = b.target = 0; b.trail = [];
  let diedAt = -1;
  for (let i = 0; i < 120 && diedAt < 0; i++) { g.step(); if (!b.alive) diedAt = g.tickNo; }
  assert(diedAt > 0, 'B לא נפסל'); assert.equal(items.list.length, 0);
  const d = g.events.find(e => e.type === 'death' && e.victim === b);
  assert(d && d.reason === 'trap' && d.killer === a);
  assert.equal(a.kills, 1); assert(a.alive);
  assert(items.events.some(e => e.type === 'trip' && e.playerId === b.id && e.ownerId === a.id));
});
test('🪤 המטיל חסין בחסד 0.6 שנ׳, ואחריו נפסל בלי קרדיט', () => {
  const { g, a, items } = fixture();
  a.item = 'trap'; const it = items.drop(g, a);
  assert(it && it.arm === g.tickNo + Items.GRACE_TICKS);
  a.frozenUntil = 1e9; a.h = a.target = 0;   // נשאר על נקודת ההטלה
  steps(g, Items.GRACE_TICKS - 1);
  assert(a.alive, 'בחסד המטיל חי'); assert.equal(items.list.length, 1);
  g.events.length = 0;
  steps(g, 1);
  assert(!a.alive, 'אחרי החסד המטיל נפסל');
  const d = g.events.find(e => e.type === 'death' && e.victim === a);
  assert(d && d.reason === 'trap' && !d.killer);
  assert.equal(a.kills, 0); assert.equal(items.list.length, 0);
});
test('🪤 מלכודת פגה אחרי 30 שנ׳ אם אף אחד לא עלה עליה', () => {
  const { g, a, items } = fixture();
  a.item = 'trap'; items.drop(g, a);
  a.x = 80; a.y = 80; a.px = a.x; a.py = a.y; a.frozenUntil = 1e9;
  steps(g, Items.TRAP_TICKS); assert.equal(items.list.length, 0);
  assert(items.events.some(e => e.type === 'expire'));
  assert(a.alive);
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
  const { g, a } = fixture(); a.item = 'trap'; a.itemN = 4; a.frozenUntil = 99; g.kill(a, null, 'self');
  assert.equal(a.item, null); assert.equal(a.itemN, 0); assert.equal(a.frozenUntil, 0);
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
test('בוט נמנע מכל מלכודת שהונחה, כולל שלו', () => {
  const { g, a, b, items } = fixture();
  items.list.push({ id: 9, k: 'trap', x: 63, y: 60, o: a.id, until: 1e9, arm: 0 });
  assert(items.dangerAt(g, b, 63, 60, 1.4), 'יריב נמנע');
  assert(items.dangerAt(g, a, 63, 60, 1.4), 'גם הבעלים נמנע');
});
test('סנכרון רשת: netState → applyNet משחזר פריטים, ידיים וקפיאה', () => {
  const { g, a, b, items } = fixture();
  a.item = 'bomb'; items.drop(g, a); b.item = 'trap'; b.itemN = 3; b.frozenUntil = g.tickNo + 60;
  const ns = items.netState(g);
  const g2 = new Game({ size: 100 }); g2.addPlayer({}); g2.addPlayer({});
  const c = new Items(); c.applyNet(g2, JSON.parse(JSON.stringify(ns.msg)), 1000, 1000 / 60);
  assert.equal(c.list.length, 1); assert.equal(c.list[0].k, 'bomb'); assert(Math.abs(c.list[0].atMs - 1000 - 3000) < 20);
  assert.equal(g2.players[1].item, 'trap'); assert.equal(g2.players[1].itemN, 3);
  assert(g2.players[1].frozenMs > 1000);
  assert.equal(g2.players[0].item, null);
  const k1 = ns.key; g.step(); assert.equal(items.netState(g).key, k1, 'key יציב כשלא השתנה דבר');
  b.itemN = 4;
  assert.notEqual(items.netState(g).key, k1, 'שינוי ערימה משנה את key');
});
test('השחקן במצב מהיר: הבורות/מלכודות נבדקים במקטע (אין מנהור)', () => {
  const g = new Game({ size: 100, speed: 600, rand: seeded(5) });
  const a = g.addPlayer({}), b = g.addPlayer({}); g.spawn(a, { x: 80, y: 80 }); g.spawn(b, { x: 10, y: 10 });
  const items = new Items(); g.itemSystem = items;
  items.list.push({ id: 1, k: 'trap', x: 15, y: 10, o: a.id, until: 1e9, arm: 0 });
  b.h = b.target = 0; g.step();
  assert(!b.alive);
  const d = g.events.find(e => e.type === 'death' && e.victim === b);
  assert(d && d.reason === 'trap' && d.killer === a);
});

test('💣 רדיוס פיצוץ פי 2.5: 8.75 יח׳ = 17.5 תאים; ראש מחוץ לישן ובתוך החדש נפסל', () => {
  assert.equal(Items.BLAST_R, Items.BLAST_R_OLD * 2.5);
  assert.equal(Items.BLAST_R, 8.75);
  const { g, a, b, items } = fixture();
  const c = g.addPlayer({ name: 'C' }); g.spawn(c, { x: 90, y: 90 });
  const bx = 50, by = 50;
  // B במרחק 5 (מעל 3.5, מתחת ל-8.75) – נפסל ברדיוס החדש
  b.x = bx + 5; b.y = by; b.px = b.x; b.py = b.y; b.frozenUntil = 1e9; b.trail = [];
  // C במרחק 9 (> 8.75) – שורד
  c.x = bx + 9; c.y = by; c.px = c.x; c.py = c.y; c.frozenUntil = 1e9; c.trail = [];
  a.item = 'bomb'; a.x = bx; a.y = by; items.drop(g, a);
  a.x = 10; a.y = 10; a.frozenUntil = 1e9; a.trail = [];
  steps(g, Items.FUSE_TICKS);
  assert(!b.alive, 'B במרחק 5 נפסל ברדיוס החדש');
  assert(c.alive, 'C במרחק 9 שורד');
  const d = g.events.find(e => e.type === 'death' && e.victim === b);
  assert(d && d.reason === 'bomb' && d.killer === a);
});
test('💣 פיצוץ שפוגע בשובל פתוח פוסל גם כשהראש מחוץ לרדיוס', () => {
  const { g, a, b, items } = fixture();
  const bx = 40, by = 40;
  a.item = 'bomb'; a.x = bx; a.y = by; items.drop(g, a);
  a.x = 10; a.y = 80; a.px = a.x; a.py = a.y; a.frozenUntil = 1e9; a.trail = [];
  // הראש של B מחוץ לרדיוס, אבל השובל חוצה את נקודת הפיצוץ
  b.x = bx; b.y = by + Items.BLAST_R + 3; b.px = b.x; b.py = b.y; b.frozenUntil = 1e9;
  steps(g, Items.FUSE_TICKS - 1);
  assert(b.alive, 'לפני הפיצוץ');
  b.trail = [b.x, b.y, bx, by];
  g.events.length = 0; steps(g, 1);
  assert(!b.alive, 'שובל בטווח – נפסל');
  const d = g.events.find(e => e.type === 'death' && e.victim === b);
  assert(d && d.reason === 'bomb' && d.killer === a);
  assert(items.events.some(e => e.type === 'boom' && e.victims.includes(b.id)));
});
test('💣 שובל שעובר ליד הפיצוץ אבל מחוץ לרדיוס לא פוסל', () => {
  const { g, a, b, items } = fixture();
  const bx = 40, by = 40;
  a.item = 'bomb'; a.x = bx; a.y = by; items.drop(g, a);
  a.x = 10; a.y = 80; a.px = a.x; a.py = a.y; a.frozenUntil = 1e9; a.trail = [];
  const far = Items.BLAST_R + 3;
  b.x = bx + far; b.y = by + far; b.px = b.x; b.py = b.y; b.frozenUntil = 1e9;
  steps(g, Items.FUSE_TICKS - 1);
  b.trail = [b.x, b.y, bx + far, by]; // מקטע אופקי במרחק far מהפצצה
  steps(g, 1);
  assert(b.alive, 'שובל מחוץ לרדיוס – חי');
});
test('🪤 רדיוס המלכודת שהונחה שווה לגודל מלכודת האיסוף (1.792), גדול מהרדיוס הישן 1.15', () => {
  assert.equal(Items.TRAP_R, 1.6 * 1.12);
  assert(Items.TRAP_R > 1.15);
  const { g, a, b, items } = fixture();
  items.list.push({ id: 1, k: 'trap', x: 60, y: 60, o: a.id, until: 1e9, arm: 0 });
  // בין 1.15 ל-1.792: פעם היה שורד, עכשיו נפסל
  b.x = 60 + 1.4; b.y = 60; b.px = b.x; b.py = b.y; b.frozenUntil = 1e9; b.trail = [];
  g.step();
  assert(!b.alive, 'במרחק 1.4 נפסל ברדיוס החדש');
  const d = g.events.find(e => e.type === 'death' && e.victim === b);
  assert(d && d.reason === 'trap' && d.killer === a);
  const { g: g2, a: a2, b: b2, items: items2 } = fixture();
  items2.list.push({ id: 1, k: 'trap', x: 60, y: 60, o: a2.id, until: 1e9, arm: 0 });
  b2.x = 60 + 1.9; b2.y = 60; b2.px = b2.x; b2.py = b2.y; b2.frozenUntil = 1e9; b2.trail = [];
  g2.itemSystem = items2; g2.step();
  assert(b2.alive, 'במרחק 1.9, מחוץ לרדיוס, שורד');
});


test('v9.27: פצצות איסוף על הרצפה בנוסף לקופסאות, כמספר תקרת ההפתעות, ומופיעות מחדש', () => {
  const g = new Game({ size: 100, rand: seeded(2) });
  g.addPlayer({}); g.spawn(g.players[0], { x: 5, y: 5 });
  const pk = new Packs({ rand: seeded(2) }); pk.reset(); pk.setItems(true);
  assert.equal(Packs.maxFor(g.W), 2);
  const n = pk.seedBombLoots(g);
  assert.equal(n, 2); assert.equal(pk.bombLootCount(), 2);
  assert.equal(pk.regularCount(), 0, 'לא נספרות כהפתעות');
  const box = pk.spawnOne(g, { x: 40, y: 40 });
  assert(box && pk.regularCount() === 1 && pk.bombLootCount() === 2);
  const pub = pk.publicList();
  assert(pub.filter(p => p.kind === 'bombloot' && p.effectId === 'bomb').length === 2, 'ברשת הסוג גלוי');
  assert(!('effectId' in pub.find(p => p.id === box.id)), 'קופסה רגילה נשארת הפתעה');
  const loot = pk.packs.find(p => p.kind === 'bombloot');
  const pl = g.players[0]; pl.x = loot.x; pl.y = loot.y;
  pk.tick(g);
  assert.equal(pl.item, 'bomb'); assert.equal(pl.itemN, 1); assert.equal(pk.bombLootCount(), 1);
  pk.bombLootCD = 0;
  for (let i = 0; i < 5 && pk.bombLootCount() < 2; i++) { pk.bombLootCD = 0; pk.tick(g); }
  assert.equal(pk.bombLootCount(), 2, 'מופיעה מחדש אחרי איסוף');
  const g130 = new Game({ size: 130, rand: seeded(4) });
  g130.addPlayer({}); g130.spawn(g130.players[0], { x: 5, y: 5 });
  const pk130 = new Packs({ rand: seeded(4) }); pk130.reset(); pk130.setItems(true);
  assert.equal(Packs.maxFor(g130.W), 3);
  assert.equal(pk130.seedBombLoots(g130), 3);
  pk.reset();
  assert.equal(pk.seedBombLoots(g), 0, 'בלי מצב מלכודת אין פצצות איסוף');
});
test('v9.27: איסוף 💣 מהרצפה כמו מקופסה; אם כבר מחזיקים פצצה היא נשארת לאחרים; מחליפה ערימת מלכודות', () => {
  const { g, a } = fixture(); const pk = new Packs(); pk.reset(); pk.setItems(true);
  pk.spawnCD = 1e9; pk.trapLootCD = 1e9; pk.bombLootCD = 1e9;
  pk.packs.push({ id: 1, x: a.x, y: a.y, kind: 'bombloot', effectId: 'bomb' }); pk.tick(g);
  assert.equal(a.item, 'bomb'); assert.equal(a.itemN, 1);
  pk.packs.push({ id: 2, x: a.x, y: a.y, kind: 'bombloot', effectId: 'bomb' }); pk.tick(g);
  assert.equal(a.item, 'bomb'); assert.equal(pk.packs.length, 1, 'כשכבר מחזיקים 💣 הפצצה נשארת על המפה');
  assert.equal(pk.packs[0].id, 2);
  a.item = 'trap'; a.itemN = 4;
  pk.packs.length = 0;
  pk.packs.push({ id: 3, x: a.x, y: a.y, kind: 'bombloot', effectId: 'bomb' }); pk.tick(g);
  assert.equal(a.item, 'bomb'); assert.equal(a.itemN, 1, 'פצצה מחליפה ערימת מלכודות, כמו מקופסה');
  assert.equal(pk.packs.length, 0);
  // מלכודת מחליפה פצצה (כמו מקופסה)
  pk.packs.push({ id: 4, x: a.x, y: a.y, kind: 'traploot', effectId: 'trap' }); pk.tick(g);
  assert.equal(a.item, 'trap'); assert.equal(a.itemN, 1);
});
test('v9.27: סיכויי הקופסאות לא השתנו אחרי הוספת פצצות איסוף', () => {
  const pk = new Packs({ rand: seeded(3) }); pk.reset(); pk.setItems(true);
  assert.equal(pk.pool().length, 10);
  const g = new Game({ size: 100, rand: seeded(1) }); g.addPlayer({}); g.spawn(g.players[0], { x: 5, y: 5 });
  const cnt = {};
  for (let i = 0; i < 20000; i++) { pk.packs.length = 0; const p = pk.spawnOne(g, { x: 50, y: 50 }); cnt[p.effectId] = (cnt[p.effectId] || 0) + 1; }
  assert.equal(Object.keys(cnt).length, 10);
  for (const k in cnt) assert(Math.abs(cnt[k] - 2000) < 300, k + ' ' + cnt[k]);
  pk.packs.length = 0; pk.setItems(true);
  pk.seedTrapLoots(g); pk.seedBombLoots(g);
  assert.equal(pk.regularCount(), 0);
  assert.equal(pk.trapLootCount(), Packs.maxFor(g.W));
  assert.equal(pk.bombLootCount(), Packs.maxFor(g.W));
});

console.log('\n' + checks + ' בדיקות מצב מלכודת עברו');
