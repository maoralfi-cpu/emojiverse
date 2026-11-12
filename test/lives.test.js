/* v9.13 מצב חיים – בדיקות node (בלי DOM). node test/lives.test.js */
const assert = require('assert');
const Lives = require('../js/lives.js');
const Game = require('../js/game.js');
const Packs = require('../js/packs.js');
const Awards = require('../js/awards.js');
const Net = require('../js/net.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('  ✓ ' + name); }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function pl(o) { return Object.assign({ id: 1, lives: 3, gone: false, alive: true, kills: 0, lastDeathTick: 0 }, o); }
function game(nPlayers, size, seed) {
  const g = new Game({ size: size || 60, rand: seeded(seed || 5) });
  for (let i = 0; i < nPlayers; i++) g.addPlayer({ name: 'P' + i, isBot: i > 0 });
  return g;
}

console.log('בסיס');
test('norm/cap: 3 או 5, ברירת מחדל 3; תקרה = התחלה + 2', () => {
  assert.equal(Lives.norm(5), 5); assert.equal(Lives.norm('3'), 3); assert.equal(Lives.norm(7), 3); assert.equal(Lives.norm(undefined), 3);
  assert.equal(Lives.cap(3), 5); assert.equal(Lives.cap(5), 7);
});
test('init נותן לכולם את מספר החיים ההתחלתי', () => {
  const ps = [{}, {}, {}]; Lives.init(ps, 5);
  ps.forEach(p => { assert.equal(p.lives, 5); assert.equal(p.invulnUntil, 0); });
});
test('פסילה מורידה חיים אחד בדיוק, ולא יורדת מתחת ל-0', () => {
  const p = pl({ lives: 2 });
  assert.equal(Lives.onDeath(p, 100), 1); assert.equal(p.lastDeathTick, 100);
  assert.equal(Lives.onDeath(p, 200), 0); assert.equal(Lives.onDeath(p, 300), 0);
  assert.ok(Lives.isOut(p));
});
test('shouldRespawn: מצב רגיל תמיד; מצב חיים רק עם חיים; עזב – אף פעם', () => {
  assert.ok(Lives.shouldRespawn(pl({ lives: 0 }), false));
  assert.ok(Lives.shouldRespawn(pl({ lives: 1 }), true));
  assert.ok(!Lives.shouldRespawn(pl({ lives: 0 }), true));
  assert.ok(!Lives.shouldRespawn(pl({ lives: 3, gone: true }), true));
});
test('hearts: לבבות מלאים/ריקים; מעל 5 – ❤️×n', () => {
  assert.equal(Lives.hearts(2, 3), '❤️❤️🤍');
  assert.equal(Lives.hearts(0, 3), '🤍🤍🤍');
  assert.equal(Lives.hearts(4, 3), '❤️❤️❤️❤️');
  assert.equal(Lives.hearts(6, 5), '❤️×6');
});

console.log('חזרה לחיים בסימולציה');
test('פסילה עם חיים => חזרה אחרי ההשהיה, עם הגנה', () => {
  const g = game(2); Lives.init(g.players, 3);
  const [a, b] = g.players; g.spawn(a, { x: 15, y: 15 }); g.spawn(b, { x: 45, y: 45 });
  g.kill(a, b, 'trail'); Lives.onDeath(a, g.tickNo);
  assert.equal(a.lives, 2); assert.equal(b.kills, 1); assert.equal(a.deaths, 1);
  let back = -1;
  for (let t = 0; t < 400 && back < 0; t++) { g.tickNo++; if (Lives.respawnStep(g, a, true, 180, 0)) back = t; }
  assert.ok(back >= 179 && back <= 200, 'חזר אחרי ~180 צעדים: ' + back);
  assert.ok(a.alive); assert.ok(Lives.isProtected(a, g.tickNo)); assert.equal(a.protMs, Lives.PROTECT_MS);
  assert.ok(g.counts[a.id] > 0, 'בסיס חדש');
});
test('ב-0 חיים – אין חזרה לעולם', () => {
  const g = game(2); Lives.init(g.players, 3);
  const a = g.players[0]; g.spawn(a, { x: 15, y: 15 }); a.lives = 1;
  g.kill(a, null, 'self'); Lives.onDeath(a, g.tickNo);
  for (let t = 0; t < 2000; t++) { g.tickNo++; assert.ok(!Lives.respawnStep(g, a, true, 180, 0)); }
  assert.ok(!a.alive);
});
test('רגרסיה – מצב רגיל: חזרה אינסופית, בלי הגנה', () => {
  const g = game(2); const a = g.players[0]; g.spawn(a, { x: 15, y: 15 });
  for (let round = 0; round < 6; round++) {
    g.kill(a, null, 'self');
    let back = false; for (let t = 0; t < 400 && !back; t++) { g.tickNo++; back = Lives.respawnStep(g, a, false, 180, 0); }
    assert.ok(back && a.alive);
    assert.ok(!a.invulnUntil, 'אין הגנה במצב רגיל');
  }
  assert.equal(a.deaths, 6);
});
test('הגנה: בזמן ההגנה לא נפסלים (שובל/ראש/בור), אחריה – כן', () => {
  const g = game(2); Lives.init(g.players, 3);
  const [a, b] = g.players; g.spawn(a, { x: 15, y: 15 }); g.spawn(b, { x: 45, y: 45 });
  Lives.protect(a, g.tickNo);
  ['trail', 'head', 'self', 'pit', 'enclosed'].forEach(r => { g.kill(a, b, r); assert.ok(a.alive, 'מוגן מ-' + r); });
  assert.equal(b.kills, 0); assert.equal(a.deaths, 0); assert.equal(g.events.length, 0);
  g.tickNo += Lives.PROTECT_TICKS;
  g.kill(a, b, 'trail'); assert.ok(!a.alive); assert.equal(b.kills, 1);
});
test('הגנה לא חוסמת עזיבה', () => {
  const g = game(2); Lives.init(g.players, 3); const a = g.players[0]; g.spawn(a, { x: 15, y: 15 });
  Lives.protect(a, g.tickNo); g.kill(a, null, 'left'); assert.ok(!a.alive);
});
test('מצב רגיל: kill עובד מיד אחרי הולדה (invulnUntil לא מוגדר)', () => {
  const g = game(2); const a = g.players[0]; g.spawn(a, { x: 15, y: 15 });
  g.kill(a, null, 'self'); assert.ok(!a.alive);
});
test('הגנה בסימולציה מלאה: ראש בראש – רק הלא-מוגן נפסל', () => {
  const g = game(2, 60, 9); Lives.init(g.players, 3);
  const [a, b] = g.players; g.spawn(a, { x: 10, y: 30 }); g.spawn(b, { x: 22, y: 30 });
  a.h = a.target = 0; b.h = b.target = Math.PI;
  Lives.protect(a, g.tickNo);
  for (let i = 0; i < 80 && b.alive; i++) g.step();
  assert.ok(a.alive, 'המוגן שרד'); assert.ok(!b.alive, 'השני נפסל');
});

console.log('סוף סיבוב וניצחון');
test('נשאר אחד עם חיים => סוף, והוא המנצח', () => {
  const ps = [pl({ id: 1, lives: 2 }), pl({ id: 2, lives: 0, lastDeathTick: 50 }), pl({ id: 3, lives: 0, lastDeathTick: 90 })];
  const r = Lives.matchOver(ps); assert.ok(r.over); assert.equal(r.winners.length, 1); assert.equal(r.winners[0].id, 1); assert.ok(!r.tie);
});
test('כמה עם חיים => ממשיכים (גם אם מתים כרגע ומחכים לחזרה)', () => {
  const ps = [pl({ id: 1, lives: 1, alive: false }), pl({ id: 2, lives: 1 })];
  assert.ok(!Lives.matchOver(ps).over);
});
test('פסילה בו-זמנית של אחרונים => תיקו בין מי שנפל באותו צעד', () => {
  const ps = [pl({ id: 1, lives: 0, lastDeathTick: 500 }), pl({ id: 2, lives: 0, lastDeathTick: 500 }), pl({ id: 3, lives: 0, lastDeathTick: 100 })];
  const r = Lives.matchOver(ps); assert.ok(r.over && r.tie);
  assert.deepEqual(r.winners.map(p => p.id).sort(), [1, 2]);
});
test('פסילה בו-זמנית אבל לאחד נשארו חיים => הוא מנצח', () => {
  const ps = [pl({ id: 1, lives: 1, alive: false, lastDeathTick: 500 }), pl({ id: 2, lives: 0, lastDeathTick: 500 })];
  const r = Lives.matchOver(ps); assert.ok(r.over && !r.tie); assert.equal(r.winners[0].id, 1);
});
test('מי שעזב לא נספר', () => {
  const ps = [pl({ id: 1, lives: 3 }), pl({ id: 2, lives: 3, gone: true })];
  assert.ok(Lives.matchOver(ps).over);
});
test('סולו בלי יריבים – לא "ניצחון" מיידי', () => {
  assert.ok(!Lives.matchOver([pl({ id: 1, lives: 3 })]).over);
});
test('תקרת בטיחות: מנצח לפי חיים, אחר כך שיא, אחר כך הריגות', () => {
  const ps = [pl({ id: 1, lives: 2, kills: 9, pk: 10 }), pl({ id: 2, lives: 3, kills: 0, pk: 5 }), pl({ id: 3, lives: 3, kills: 1, pk: 20 })];
  const w = Lives.safetyWinners(ps, p => p.pk); assert.equal(w.length, 1); assert.equal(w[0].id, 3);
});

console.log('דירוג במצב חיים');
test('האחרון שנשאר ראשון גם עם מעט שטח; אחר כך מי ששרד יותר זמן', () => {
  const rows = Lives.rankRows([
    { id: 1, lives: 0, lastDeathTick: 100, kills: 9, peak: 60 },
    { id: 2, lives: 1, lastDeathTick: 0, kills: 0, peak: 2, win: true },
    { id: 3, lives: 0, lastDeathTick: 900, kills: 0, peak: 5 },
    { id: 4, lives: 0, lastDeathTick: 900, kills: 3, peak: 1 }
  ]);
  assert.deepEqual(rows.map(r => r.id), [2, 4, 3, 1]);
  assert.deepEqual(rows.map(r => r.place), [1, 2, 3, 4]);
});
test('תיקו במקום ראשון – שניהם במקום 1', () => {
  const rows = Lives.rankRows([{ id: 1, lives: 0, lastDeathTick: 5, kills: 0, peak: 1, win: true }, { id: 2, lives: 0, lastDeathTick: 5, kills: 2, peak: 1, win: true }, { id: 3, lives: 0, lastDeathTick: 1, kills: 0, peak: 1 }]);
  assert.deepEqual(rows.map(r => r.place), [1, 1, 3]);
});
test('דירוג רגיל (Net.ranking) לא השתנה – לפי שטח בסוף', () => {
  const g = game(2); const [a, b] = g.players; g.spawn(a, { x: 15, y: 15 }); g.spawn(b, { x: 45, y: 45 });
  g.stamp(45, 45, 6, b.id); const r = Net.ranking(g); assert.equal(r[0].id, b.id);
});

console.log('חבילת ❤️');
function packGame() {
  const rand = seeded(11); const g = new Game({ size: 80, rand });
  const a = g.addPlayer({ name: 'A' }), b = g.addPlayer({ name: 'B', isBot: true });
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  const packs = new Packs({ rand }); packs.reset();
  return { g, a, b, packs };
}
test('+1 חיים באיסוף, אירוע pick עם effectId=life, בלי אפקט זמני', () => {
  const { g, a, packs } = packGame(); Lives.init(g.players, 3); packs.setLives(3);
  a.lives = 2;
  const h = packs.spawnHeart(g, { x: a.x, y: a.y }); assert.ok(h && h.kind === 'life');
  packs.events.length = 0; packs.tick(g);
  assert.equal(a.lives, 3); assert.ok(!packs.activeOf(a.id), 'לא אפקט 🎁');
  const ev = packs.events.find(e => e.type === 'pick'); assert.equal(ev.effectId, 'life'); assert.equal(ev.playerId, a.id);
  assert.equal(packs.heartCount(), 0);
});
test('תקרה: בתקרה לא אוספים (הלב נשאר); עד start+2', () => {
  const { g, a, packs } = packGame(); Lives.init(g.players, 3); packs.setLives(3);
  a.lives = 5; packs.spawnHeart(g, { x: a.x, y: a.y }); packs.tick(g);
  assert.equal(a.lives, 5); assert.equal(packs.heartCount(), 1);
  a.lives = 4; packs.tick(g); assert.equal(a.lives, 5); assert.equal(packs.heartCount(), 0);
});
test('לב לא מופיע כשכל השחקנים הפעילים בתקרה; מופיע כשמישהו מתחת', () => {
  const { g, packs } = packGame(); Lives.init(g.players, 3); packs.setLives(3);
  g.players.forEach(p => p.lives = 5);
  for (let i = 0; i < 3000; i++) { g.tickNo++; packs.tick(g); }
  assert.equal(packs.heartCount(), 0);
  g.players[1].lives = 2;
  for (let i = 0; i < 200 && !packs.heartCount(); i++) { g.tickNo++; packs.tick(g); }
  assert.equal(packs.heartCount(), 1);
});
test('מצב רגיל: לב אף פעם לא מופיע, ומאגר ה-🎁 לא השתנה', () => {
  const { g, packs } = packGame();
  for (let i = 0; i < 5000; i++) { g.tickNo++; packs.tick(g); packs.packs.forEach(p => assert.notEqual(p.kind, 'life')); }
  assert.deepEqual(Packs.EFFECT_IDS, ['speed', 'slow', 'invert', 'wide']);
  assert.ok(!Packs.effect('life'));
  assert.equal(packs.spawnHeart(g), null);
});
test('במצב חיים 🎁 רגילות ממשיכות להופיע, והלב לא תופס להן מקום', () => {
  const { g, packs } = packGame(); Lives.init(g.players, 3); packs.setLives(3);
  g.players[0].lives = 1;
  packs.spawnHeart(g); for (let i = 0; i < 600; i++) { g.tickNo++; packs.tick(g); }
  assert.equal(packs.regularCount(), Packs.maxFor(g.W)); assert.ok(packs.heartCount() <= 1);
});
test('לב נדיר יותר מחבילה רגילה (מרווח הופעה)', () => { assert.ok(Packs.HEART_EVERY > 150 * 3); });
test('רשת: publicList/applySync/clientSpawn שומרים kind=life; לקוח לא משנה חיים בעצמו', () => {
  const { g, a, packs } = packGame(); Lives.init(g.players, 3); packs.setLives(3); a.lives = 2;
  packs.spawnHeart(g, { x: 10, y: 10 });
  const pub = packs.publicList(); assert.equal(pub[0].kind, 'life'); assert.ok(!('effectId' in pub[0]));
  const c = new Packs(); c.applySync(pub); assert.equal(c.packs[0].kind, 'life');
  const c2 = new Packs(); c2.clientSpawn(7, 1, 1, 'life'); assert.equal(c2.packs[0].kind, 'life');
  const fx = c2.clientPick(g, 7, a.id, 'life'); assert.equal(fx.emoji, '❤️'); assert.equal(c2.packs.length, 0); assert.equal(a.lives, 2);
  const ev = packs.events.find(e => e.type === 'spawn'); assert.equal(ev.pack.kind, 'life');
});

console.log('סולו');
test('פסילה ראשונה עם חיים – לא סוף משחק; 0 חיים – סוף; מצב רגיל – תמיד סוף', () => {
  assert.ok(!Lives.soloGameOver({ lives: 2 }, true));
  assert.ok(Lives.soloGameOver({ lives: 0 }, true));
  assert.ok(Lives.soloGameOver({ lives: 3 }, false));
});
test('סולו: כל הבוטים מודחים ולי נשארו חיים => ניצחון שלי', () => {
  const ps = [pl({ id: 1, lives: 1, alive: false }), pl({ id: 2, lives: 0, lastDeathTick: 10 }), pl({ id: 3, lives: 0, lastDeathTick: 20 })];
  const r = Lives.matchOver(ps); assert.ok(r.over); assert.equal(r.winners[0].id, 1);
});

console.log('סיבובים, הצטרפות באמצע וניקוד מצטבר');
test('"עוד סיבוב": משחק חדש מחזיר חיים מלאים; הניקוד המצטבר נשמר', () => {
  let totals = Awards.empty();
  const g1 = game(2); Lives.init(g1.players, 3); g1.players[0].key = 'a'; g1.players[1].key = 'b';
  g1.players[0].lives = 0; g1.players[1].kills = 3;
  totals = Awards.addRound(totals, g1.players.map(p => ({ key: p.key, name: p.name, kills: p.kills, pct: 0, peak: 12, deaths: 1 })));
  const g2 = game(2); Lives.init(g2.players, 3);
  g2.players.forEach(p => assert.equal(p.lives, 3));
  totals = Awards.addRound(totals, [{ key: 'a', name: 'a', kills: 1, pct: 0, peak: 5, deaths: 0 }, { key: 'b', name: 'b', kills: 2, pct: 0, peak: 7, deaths: 0 }]);
  assert.equal(totals.b.kills, 5); assert.equal(totals.a.pct, 17); assert.equal(totals.a.rounds, 2);
});
test('"ללובי" מאפס – סיכום ריק', () => { assert.deepEqual(Awards.empty(), {}); });
test('מצטרף באמצע מקבל את מספר החיים ההתחלתי', () => {
  const g = game(2); Lives.init(g.players, 5); g.players[0].lives = 1;
  const p = Lives.initPlayer(g.addPlayer({ name: 'new' }), 5);
  assert.equal(p.lives, 5); assert.equal(g.players[0].lives, 1);
});
test('תמונת המצב הבינארית לא תלויה בחיים (זהה במצב רגיל)', () => {
  const g = game(3); g.players.forEach((p, i) => g.spawn(p, { x: 10 + i * 20, y: 30 }));
  const a = new Uint8Array(Net.encodeSnap(g, new Net.Tracker(g), 1000, false));
  Lives.init(g.players, 3); g.players[0].lives = 1; Lives.protect(g.players[1], g.tickNo, 5);
  const b = new Uint8Array(Net.encodeSnap(g, new Net.Tracker(g), 1000, false));
  assert.deepEqual(Array.from(a), Array.from(b));
});

console.log('\n' + n + ' בדיקות מצב חיים עברו');
