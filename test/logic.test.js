// בדיקות לוגיקה לתנועה רציפה: node test/logic.test.js
const Game = require('../js/game.js');
const AI = require('../js/ai.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = 0, D = Math.PI / 2, L = Math.PI, U = -Math.PI / 2;
// נהיגה בכיוון קבוע (מכוון גם את הכיוון בפועל, כדי לצייר צורות מדויקות)
function go(g, p, ang, dist) { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && p.alive; i++) { p.h = p.target = ang; g.step(); } }
const own = (g, p, x, y) => g.ownerAt(x, y) === p.id;

console.log('כיבוש לולאה מלבנית (קו שבור)');
{
  const g = new Game({ size: 60, rand: seeded(1) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  const a0 = g.counts[p.id];
  ok(Math.abs(a0 * 0.25 - Math.PI * 3.2 * 3.2) < 3, 'שטח התחלתי עגול ≈ πr² (' + (a0 * 0.25).toFixed(1) + ')');
  go(g, p, R, 12); ok(p.trail.length > 10, 'מחוץ לשטח נוצר שובל של נקודות');
  go(g, p, D, 10); go(g, p, L, 12);
  go(g, p, U, 7);
  ok(p.alive && p.trail.length === 0, 'חזר לשטח, השובל נסגר');
  ok(own(g, p, 26, 25) && own(g, p, 30, 27) && own(g, p, 22, 28), 'פנים הלולאה נכבש');
  ok(!own(g, p, 36, 25) && !own(g, p, 26, 33) && !own(g, p, 26, 15), 'מחוץ ללולאה לא נכבש');
  const area = g.counts[p.id] * 0.25;
  ok(area > 110 && area < 175, 'שטח כולל סביר (' + area.toFixed(1) + ' יח"ר)');
}

console.log('כיבוש לולאה מעוקלת (סיבוב רציף)');
{
  const g = new Game({ size: 60, rand: seeded(2) });
  const p = g.addPlayer({}); g.spawn(p, { x: 30, y: 30 });
  p.h = p.target = R;
  go(g, p, R, 6);
  // קשת רכה של ~180° ואז היגוי חופשי חזרה הביתה
  for (let i = 0; i < 46; i++) { p.target = p.h + 0.07; g.step(); }
  let n = 0; while (p.alive && p.trail.length && n++ < 400) { p.target = Math.atan2(30 - p.y, 30 - p.x); g.step(); }
  ok(p.alive && p.trail.length === 0, 'הקשת נסגרה וחזר');
  ok(g.counts[p.id] * 0.25 > Math.PI * 3.2 * 3.2 + 20, 'השטח גדל (' + (g.counts[p.id] * 0.25).toFixed(1) + ')');
}

console.log('פגיעה בשובל של יריב (מרחק נקודה-מקטע)');
{
  const g = new Game({ size: 60, rand: seeded(3) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 10, y: 20 }); g.spawn(b, { x: 40, y: 45 });
  go(g, a, R, 10); // a בחוץ, שובל אופקי ב-y=20 עד x≈20
  ok(a.alive && a.trail.length > 6, 'a בחוץ עם שובל');
  b.x = 16; b.y = 24; b.trail = []; b.h = b.target = U; // b חוצה את השובל של a
  for (let i = 0; i < 20 && a.alive; i++) { a.h = a.target = D; b.h = b.target = U; g.step(); }
  ok(!a.alive, 'a נפסל כש-b חצה את השובל');
  ok(b.alive && b.kills === 1, 'b קיבל הריגה');
  ok(g.counts[a.id] === 0, 'השטח של a נמחק');
}

console.log('התקרבות לשובל בלי לגעת');
{
  const g = new Game({ size: 60, rand: seeded(4) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 10, y: 20 }); g.spawn(b, { x: 40, y: 45 });
  go(g, a, R, 10);
  b.x = 30; b.y = 21.2; b.trail = []; b.h = b.target = L; // נוסע במקביל, 1.2 יחידות מהשובל
  for (let i = 0; i < 25; i++) { a.h = a.target = R; b.h = b.target = L; g.step(); }
  ok(a.alive, 'מרחק 1.2 > רדיוס פגיעה – אין פסילה');
}

console.log('שובל עצמי');
{
  const g = new Game({ size: 60, rand: seeded(5) });
  const p = g.addPlayer({}); g.spawn(p, { x: 10, y: 30 });
  go(g, p, R, 8);
  let n = 0; while (p.alive && n++ < 200) { p.target = p.h + 1; g.step(); } // מעגל צר מחוץ לשטח
  ok(!p.alive, 'מעגל מלא מחוץ לשטח – נפסל בשובל של עצמו');
  const g2 = new Game({ size: 60, rand: seeded(6) });
  const q = g2.addPlayer({}); g2.spawn(q, { x: 10, y: 30 });
  go(g2, q, R, 8);
  for (let i = 0; i < 14; i++) { q.target = q.h + 1; g2.step(); } // פנייה חדה של ~180°
  go(g2, q, q.h, 2);
  ok(q.alive, 'פניית פרסה חדה לא נחשבת פגיעה עצמית');
}

console.log('קיר');
{
  const g = new Game({ size: 40, rand: seeded(7) });
  const p = g.addPlayer({}); g.spawn(p, { x: 6, y: 20 });
  go(g, p, L, 10);
  ok(!p.alive, 'נפסל ביציאה מהמפה');
}

console.log('ראש בראש');
{
  const g = new Game({ size: 80, rand: seeded(8) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 10, y: 40 }); g.spawn(b, { x: 70, y: 40 });
  a.h = a.target = R; b.h = b.target = L;
  go(g, a, R, 6); b.x = 70; b.y = 40; b.trail = [];   // a יוצא קודם => שובל ארוך יותר
  for (let i = 0; i < 400 && a.alive && b.alive; i++) { a.h = a.target = R; b.h = b.target = L; g.step(); }
  ok(!a.alive && b.alive, 'שניהם בחוץ – בעל השובל הארוך נפסל');
  const g2 = new Game({ size: 60, rand: seeded(9) });
  const c = g2.addPlayer({}), d = g2.addPlayer({});
  g2.spawn(c, { x: 20, y: 30 }); g2.spawn(d, { x: 45, y: 30 });
  d.x = 26; d.y = 30; d.trail = [];
  for (let i = 0; i < 10 && d.alive; i++) { c.h = c.target = R; d.h = d.target = L; g2.step(); }
  ok(c.alive && !d.alive && c.kills === 1, 'מי שבתוך השטח שלו שורד');
}

// מימוש ייחוס: מילוי נאיבי מכל גבול המפה
function reference(owner, G, id) {
  const seen = new Uint8Array(G * G), st = [];
  const add = k => { if (!seen[k] && owner[k] !== id) { seen[k] = 1; st.push(k); } };
  for (let i = 0; i < G; i++) { add(i); add((G - 1) * G + i); add(i * G); add(i * G + G - 1); }
  while (st.length) { const c = st.pop(), x = c % G, y = (c - x) / G;
    if (x > 0) add(c - 1); if (x < G - 1) add(c + 1); if (y > 0) add(c - G); if (y < G - 1) add(c + G); }
  const out = new Uint8Array(G * G); for (let k = 0; k < G * G; k++) out[k] = owner[k] === id || !seen[k] ? 1 : 0; return out;
}
console.log('השוואה למימוש ייחוס – 400 מסלולים אקראיים');
{
  let good = 0, total = 0;
  for (let t = 0; t < 400; t++) {
    const rnd = seeded(100 + t), g = new Game({ size: 40, rand: rnd });
    const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
    let steps = 0;
    while (p.alive && steps++ < 400) {
      p.target = p.h + (rnd() - 0.45) * 0.8;
      const willHome = p.trail.length > 0;
      const snapOwner = g.owner.slice(), snapTrail = p.trail.slice();
      const before = g.counts[p.id];
      g.step();
      if (willHome && p.alive && p.trail.length === 0) {
        // ייחוס: מטביעים את אותו שובל על עותק ואז מילוי נאיבי
        const h = new Game({ size: 40 }); h.owner.set(snapOwner); h.counts[p.id] = before;
        h.players.push(p);
        const tr = snapTrail.concat([p.x, p.y]);
        for (let k = 0; k + 3 < tr.length; k += 2) { const ax = tr[k], ay = tr[k+1], bx = tr[k+2], by = tr[k+3];
          const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (h.CELL * 0.5)));
          for (let s = 0; s <= m; s++) h.stamp(ax + (bx - ax) * s / m, ay + (by - ay) * s / m, h.STAMP_R, p.id); }
        const ref = reference(h.owner, h.G, p.id); let same = true;
        for (let k = 0; k < ref.length; k++) if ((g.owner[k] === p.id ? 1 : 0) !== ref[k]) { same = false; break; }
        total++; if (same) good++;
      }
    }
  }
  ok(total > 30 && good === total, `כיבוש זהה לייחוס ב-${good}/${total} מקרים`);
}

console.log('סימולציית בוטים');
for (const lvl of ['easy', 'normal', 'hard']) {
  const g = new Game({ size: 100, rand: seeded(11) });
  for (let i = 0; i < 8; i++) { const p = g.addPlayer({ isBot: true }); g.spawn(p); }
  let deaths = 0, captures = 0, t0 = Date.now(), reasons = {};
  const ticks = 6000; // 5 דקות משחק
  for (let s = 0; s < ticks; s++) {
    for (const p of g.players) if (p.alive) AI.think(g, p, lvl);
    g.step();
    for (const e of g.events) { if (e.type === 'death') { deaths++; reasons[e.reason] = (reasons[e.reason] || 0) + 1; } if (e.type === 'capture') captures++; }
    g.events.length = 0;
    if (s % 40 === 0) for (const p of g.players) if (!p.alive) g.spawn(p);
  }
  const c = new Int32Array(32); for (let i = 0; i < g.owner.length; i++) c[g.owner[i]]++;
  let cons = true; for (let k = 1; k <= 8; k++) if (c[k] !== g.counts[k]) cons = false;
  const ms = Date.now() - t0;
  ok(cons && captures > 200 && deaths < captures / 3, `${lvl}: ${captures} כיבושים, ${deaths} מיתות ${JSON.stringify(reasons)}, ${(ms / ticks).toFixed(2)}ms לצעד, שטח מקס' ${Math.max(...g.players.map(p => p.bestPct)).toFixed(1)}%`);
}
console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
