// בדיקות פרוטוקול הרשת: קידוד/פענוח, סנכרון מראה מול מארח, הצטרפות באמצע, קלט מוגבל קצב
const Game = require('../js/game.js'), AI = require('../js/ai.js'), Net = require('../js/net.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function mirrorOf(g) { const m = new Game({ size: g.W }); g.players.forEach(p => m.addPlayer({ name: p.name, isBot: p.isBot, avatar: p.avatar, color: p.color })); return m; }
function same(g, m) {
  let cells = 0; for (let i = 0; i < g.owner.length; i++) if (g.owner[i] !== m.owner[i]) cells++;
  let trails = 0, pos = 0;
  g.players.forEach((p, k) => { const q = m.players[k];
    if (!p.alive) return;
    if (p.trail.length !== q.trail.length) trails++;
    else for (let i = 0; i < p.trail.length; i++) if (Math.abs(p.trail[i] - q.trail[i]) > 0.006) { trails++; break; }
  });
  let counts = 0; for (let id = 1; id <= g.players.length; id++) if (g.counts[id] !== m.counts[id]) counts++;
  return { cells, trails, counts };
}

console.log('קידוד/פענוח תמונת מצב');
{
  const g = new Game({ size: 100, rand: seeded(5) });
  for (let i = 0; i < 6; i++) g.spawn(g.addPlayer({ isBot: true, name: 'b' + i }));
  const m = mirrorOf(g), tr = new Net.Tracker(g);
  let maxB = 0, sumB = 0, n = 0, bad = 0, last = null;
  for (let s = 0; s < 3600; s++) {
    for (const p of g.players) if (p.alive && (g.tickNo + p.id) % 2 === 0) AI.think(g, p, 'normal');
    g.step(); g.events.length = 0;
    for (const p of g.players) if (!p.alive && g.tickNo % 120 === 0) g.spawn(p);
    if (s % 3 === 0) {
      const buf = Net.encodeSnap(g, tr, 123456, false);
      if (n > 0) { maxB = Math.max(maxB, buf.byteLength); sumB += buf.byteLength; }
      n++; last = Net.decodeSnap(buf, m);
      const d = same(g, m); if (d.cells || d.trails || d.counts) bad++;
    }
  }
  last = Net.decodeSnap(Net.encodeSnap(g, tr, 123456, false), m);
  ok(bad === 0, 'המראה זהה למארח בכל ' + n + ' התמונות (שטח, שובלים, ספירות)');
  ok(last.msLeft === 123456 && last.players.length === 6 && last.tick === g.tickNo, 'כותרת: זמן, צעד ומספר שחקנים');
  const p0 = g.players[0], s0 = last.players[0];
  ok(Math.abs(p0.x - s0.x) <= 0.006 && Math.abs(p0.y - s0.y) <= 0.006 && Math.abs(Game.angDiff(p0.h, s0.h)) < 0.001, 'מיקום וכיוון בדיוק של 0.01');
  ok(sumB / (n - 1) < 900, 'גודל ממוצע ' + Math.round(sumB / (n - 1)) + ' בתים (×20/ש\' ≈ ' + Math.round(sumB / (n - 1) * 20 / 1024) + 'KB/ש\'), מקס\' ' + maxB);
  // הצטרפות באמצע: מעקב חדש = רשת מלאה
  const m2 = mirrorOf(g), full = Net.encodeSnap(g, new Net.Tracker(g), 0, false);
  Net.decodeSnap(full, m2);
  let d = same(g, m2);
  ok(!d.cells && !d.trails && !d.counts, 'הצטרפות באמצע: רשת מלאה ' + full.byteLength + ' בתים משחזרת הכול');
  // ואחר כך דלתות משותפות ממשיכות לעבוד גם אצלו
  for (let s = 0; s < 300; s++) {
    for (const p of g.players) if (p.alive && (g.tickNo + p.id) % 2 === 0) AI.think(g, p, 'normal');
    g.step(); g.events.length = 0;
    if (s % 3 === 0) { const b = Net.encodeSnap(g, tr, 0, false); Net.decodeSnap(b, m); Net.decodeSnap(b, m2); }
  }
  const b = Net.encodeSnap(g, tr, 0, false); Net.decodeSnap(b, m); Net.decodeSnap(b, m2);
  d = same(g, m2); const d1 = same(g, m);
  ok(!d.cells && !d.trails && !d1.cells && !d1.trails, 'אחרי הצטרפות – שני הלקוחות נשארים מסונכרנים');
}

console.log('שחקן שעוזב');
{
  const g = new Game({ size: 80, rand: seeded(7) });
  const a = g.addPlayer({ name: 'א' }), b = g.addPlayer({ name: 'ב' });
  g.spawn(a, { x: 20, y: 40 }); g.spawn(b, { x: 60, y: 40 });
  const m = mirrorOf(g), tr = new Net.Tracker(g);
  Net.decodeSnap(Net.encodeSnap(g, tr, 0, false), m);
  ok(m.counts[b.id] > 0, 'שטח של ב הגיע ללקוח');
  b.gone = true; g.kill(b, null, 'left');
  const st = Net.decodeSnap(Net.encodeSnap(g, tr, 0, false), m);
  ok(m.counts[b.id] === 0 && st.players[1].gone && !st.players[1].alive, 'עזיבה: השטח נמחק אצל הלקוח והשחקן מסומן כעזב');
}

console.log('קלט: רק בשינוי, מוגבל קצב');
{
  const sent = []; const th = new Net.InputThrottle(a => sent.push(a), 33, 0.01);
  th.push(1, 0); th.push(1.001, 5); th.push(1.2, 10); th.push(1.3, 20);
  ok(sent.length === 1, 'שינוי זעיר ושינויים מהירים לא נשלחים מיד');
  th.flush(40); ok(sent.length === 2 && sent[1] === 1.3, 'הערך האחרון נשלח אחרי 33ms');
  th.push(1.3, 100); ok(sent.length === 2, 'אותו כיוון – לא נשלח שוב');
}

console.log('קוד חדר ודירוג');
{
  const r = seeded(3), codes = new Set(); for (let i = 0; i < 200; i++) codes.add(Net.roomCode(r));
  ok([...codes].every(c => Net.validCode(c) && !/[O0I1L]/.test(c)), 'קודים של 4 תווים בלי תווים מבלבלים');
  ok(Net.cleanCode(' ab-c9 ') === 'ABC9' && Net.cleanName('<b>דני</b>') === 'bדני/b', 'ניקוי קוד ושם');
  const g = new Game({ size: 60, rand: seeded(9) });
  const a = g.addPlayer({ name: 'א' }), b = g.addPlayer({ name: 'ב' }); g.spawn(a, { x: 15, y: 30 }); g.spawn(b, { x: 45, y: 30 });
  g.stamp(45, 30, 6, b.id);
  const rk = Net.ranking(g); ok(rk[0].name === 'ב' && rk.length === 2, 'דירוג לפי שטח');
}
console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
