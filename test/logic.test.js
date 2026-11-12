// בדיקות לוגיקה לתנועה רציפה: node test/logic.test.js
const Game = require('../js/game.js');
const AI = require('../js/ai.js');
const DragInput = require('../js/input.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = 0, D = Math.PI / 2, L = Math.PI, U = -Math.PI / 2;
// נהיגה בכיוון קבוע (מכוון גם את הכיוון בפועל, כדי לצייר צורות מדויקות)
function go(g, p, ang, dist) { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && p.alive; i++) { p.h = p.target = ang; g.step(); } }
const near = (a, b) => Math.abs(Game.angDiff(a, b)) < 0.02;
const own = (g, p, x, y) => g.ownerAt(x, y) === p.id;

console.log('כיבוש לולאה מלבנית (קו שבור)');
{
  const g = new Game({ size: 60, rand: seeded(1) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  const a0 = g.counts[p.id];
  ok(Math.abs(a0 * 0.25 - Math.PI * 3.2 * 3.2) < 3, 'שטח התחלתי עגול ≈ πr² (' + (a0 * 0.25).toFixed(1) + ')');
  go(g, p, R, 12); ok(p.trail.length > 10, 'מחוץ לשטח נוצר שובל של נקודות');
  go(g, p, D, 10); go(g, p, L, 12);
  go(g, p, U, 8);
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
  for (let i = 0; i < 40 && a.alive; i++) { a.h = a.target = D; b.h = b.target = U; g.step(); }
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
  for (let i = 0; i < 50; i++) { a.h = a.target = R; b.h = b.target = L; g.step(); }
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
  const h0 = q.h; let turned = 0;
  while (turned < Math.PI - 1e-6) { q.target = h0 + Math.PI; g2.step(); turned = Math.abs(Game.angDiff(q.h, h0)); } // פניית פרסה במהירות סיבוב מקסימלית
  go(g2, q, q.h, 2);
  ok(q.alive, 'פניית פרסה חדה לא נחשבת פגיעה עצמית');
}


console.log('מיפוי קלט מגע לזווית');
{

  const d = new DragInput('medium', 'drag');
  d.down(100, 100);
  ok(d.move(105, 103) === null, 'אזור מת: תזוזה של ~6px לא משנה כיוון');
  ok(near(d.move(130, 100), 0), 'ימינה = 0');
  d.down(100, 100); ok(near(d.move(100, 60), -Math.PI / 2), 'למעלה במסך = -π/2 (y למטה, בלי היפוך)');
  d.down(100, 100); ok(near(d.move(70, 100), Math.PI), 'שמאלה = π (בלי בלבול RTL)');
  d.down(100, 100); ok(near(d.move(130, 130), Math.PI / 4), 'אלכסון למטה-ימינה = π/4');
  // העוגן נגרר: אחרי גרירה ארוכה ימינה, תזוזה קטנה למעלה משנה כיוון מיד
  d.down(0, 0); d.move(200, 0);
  ok(Math.abs(d.ax - 140) < 1e-6, 'העוגן נגרר במרחק 60px מאחורי האצבע');
  const a = d.move(200, -40);
  const a2 = d.move(200, -40);
  ok(a < -0.4 && Math.abs(a2 - Math.atan2(-40, 60)) < 0.15, 'שינוי כיוון מיד אחרי גרירה ארוכה (' + a.toFixed(2) + ' → ' + a2.toFixed(2) + ')');
  const lo = new DragInput('low', 'drag'); lo.down(0, 0);
  ok(lo.move(10, 0) === null && new DragInput('high').cfg.dead < 8, 'רגישות: אזור מת גדול יותר ב"נמוכה", קטן יותר ב"גבוהה"');
  const j = new DragInput('medium', 'joy'); j.down(50, 50); const ja = j.move(50 + 200, 50 + 200);
  ok(near(ja, Math.PI / 4) && Math.hypot(j.kx, j.ky) <= 50.001, "ג'ויסטיק: זווית אנלוגית, הידית מוגבלת לרדיוס");
}

console.log('מהירות וסיבוב');
{
  const g = new Game({ size: 60, rand: seeded(21) });
  ok(Math.abs(g.SPEED - 9.75) < 1e-9, 'מהירות 9.75 יח\'/ש\' (×1.5)');
  ok(g.TURN * 180 / Math.PI >= 360 && g.TURN * 180 / Math.PI <= 420, 'קצב סיבוב מקסימלי 360–420°/ש\' כמו במקור (' + Math.round(g.TURN * 180 / Math.PI) + ')');
  const p = g.addPlayer({}); g.spawn(p, { x: 30, y: 30 }); p.h = p.target = 0;
  p.target = Math.PI * 0.999; let n = 0; while (Math.abs(Game.angDiff(p.h, p.target)) > 1e-6 && n < 100) { g.step(); n++; }
  ok(n * g.DT <= 0.5, 'פנייה של 180° תוך ' + (n * g.DT).toFixed(2) + ' שניות');
}

console.log('v4: רדיוס סיבוב ומצב הצבעה');
{
  const g = new Game({ size: 60, rand: seeded(41) });
  const r = g.SPEED / g.TURN;
  ok(r > 1.3 && r < 1.6, 'רדיוס סיבוב מינימלי ' + r.toFixed(2) + ' יח\' (≈1.8 רוחבי שובל 0.8)');
  ok(Math.abs(g.DT - 1 / 60) < 1e-12 && g.AI_EVERY === 2, 'לוגיקה ב-60 צעדים לשנייה, בוטים ב-30');
  const d = new DragInput('medium', 'point'); d.setCenter(200, 400);
  ok(near(d.down(300, 400), 0), 'נגיעה מימין לדמות = 0 מיד בנגיעה');
  ok(near(d.move(200, 300), -Math.PI / 2) || d.angle !== null, 'הזזה מעל הדמות פונה למעלה (עם החלקה)');
  const h = new DragInput('high', 'point'); h.setCenter(0, 0); h.down(10, 10);
  ok(near(h.move(-50, 0), Math.PI), 'רגישות גבוהה: בלי החלקה, שמאלה = π');
  ok(h.aim(3, 3) === null, 'אזור מת סביב הדמות');
  h.up(); ok(h.move(0, 50) === null && near(h.angle, Math.PI), 'אחרי הרמת האצבע הכיוון האחרון נשמר');
}

console.log('אין "מנהור" דרך שובל');
{
  // מהירות קיצונית: צעד אחד ארוך מפי 2 מרוחב הפגיעה – בדיקה סוחפת חייבת לתפוס
  let caught = 0, tries = 0;
  for (let off = 0; off < 1; off += 0.05) {
    const g = new Game({ size: 60, speed: 80, rand: seeded(30) });
    const a = g.addPlayer({}), b = g.addPlayer({});
    g.spawn(a, { x: 10, y: 20 }); g.spawn(b, { x: 45, y: 50 });
    a.trail = [15, 20, 25, 20]; a.tb = [15, 20, 25, 20]; a.x = 25; a.y = 20; a.h = a.target = 0; a.x = 14; a.y = 25; // a ממשיך מחוץ למסלול
    a.trail = [15, 20, 25, 20]; a.x = 25.5; a.y = 20;
    b.x = 20; b.y = 20 + 0.6 + off; b.h = b.target = -Math.PI / 2; b.trail = [];
    a.h = a.target = Math.PI / 2;
    g.step(); tries++;
    if (!a.alive) caught++;
  }
  ok(caught === tries, `חציית שובל בצעד ארוך נתפסה ${caught}/${tries}`);
  // ובמהירות הרגילה, מכל זווית חצייה
  let c2 = 0, t2 = 0;
  for (let ang = 0.3; ang < Math.PI - 0.3; ang += 0.15) {
    const g = new Game({ size: 60, rand: seeded(31) });
    const a = g.addPlayer({}), b = g.addPlayer({});
    g.spawn(a, { x: 5, y: 5 }); g.spawn(b, { x: 50, y: 50 });
    a.trail = [10, 30, 40, 30]; a.tb = [10, 30, 40, 30]; a.x = 40; a.y = 30.0; a.h = a.target = 0;
    b.x = 25 - Math.cos(ang) * 3; b.y = 30 + Math.sin(ang) * 3; b.h = b.target = -ang; b.trail = [];
    for (let i = 0; i < 60 && a.alive; i++) { a.target = a.h; b.target = -ang; g.step(); }
    t2++; if (!a.alive) c2++;
  }
  ok(c2 === t2, `חציה בזוויות שונות במהירות הרגילה נתפסה ${c2}/${t2}`);
}

console.log('טורוס: אין קיר, עטיפה');
{
  const g = new Game({ size: 40, rand: seeded(7) });
  const p = g.addPlayer({}); g.spawn(p, { x: 6, y: 20 });
  let maxJump = 0, px = p.x, minX = 99;
  const n = Math.round(12 / (g.SPEED * g.DT));
  for (let i = 0; i < n; i++) { p.h = p.target = L; g.step(); maxJump = Math.max(maxJump, Math.abs(Game.wrapDelta(p.x - px, 40))); px = p.x; minX = Math.min(minX, p.x); }
  ok(p.alive && p.x > 30 && p.x < 40, 'יצא משמאל ונכנס מימין, חי (x=' + p.x.toFixed(2) + ')');
  ok(maxJump < g.SPEED * g.DT + 1e-6, 'התנועה רציפה (קפיצה עטופה מקס ' + maxJump.toFixed(3) + ')');
  const t = p.trail; let seg = 0; for (let k = 0; k + 3 < t.length; k += 2) seg = Math.max(seg, Math.hypot(t[k+2]-t[k], t[k+3]-t[k+1]));
  ok(seg < 1, 'השובל נשמר רציף – אין מקטע שחוצה את כל המפה (' + seg.toFixed(3) + ')');
  ok(Game.wrapDelta(39, 40) === -1 && Game.wrapDelta(-39, 40) === 1 && g.dist2(0.5, 0.5, 39.5, 39.5) === 2, 'wrapDelta / dist2');
  ok(g.ownerAt(-0.1, 20.2) === g.ownerAt(39.9, 20.2) && g.cellAt(40.2, 0) === g.cellAt(0.2, 0), 'אינדקסים עוטפים');
}

console.log('טורוס: כיבוש');
{ // לולאה רגילה
  const g = new Game({ size: 60, rand: seeded(21) });
  const p = g.addPlayer({}); g.spawn(p, { x: 30, y: 30 });
  go(g, p, R, 10); go(g, p, D, 10); go(g, p, L, 12); go(g, p, U, 8);
  ok(p.alive && !p.trail.length && own(g, p, 36, 35) && !own(g, p, 45, 35) && !own(g, p, 10, 10), 'לולאה רגילה: פנים נכבש, השאר לא');
}
{ // לולאה שחוצה את התפר האנכי (x=0)
  const g = new Game({ size: 60, rand: seeded(22) });
  const p = g.addPlayer({}); g.spawn(p, { x: 2, y: 30 });
  go(g, p, L, 10); go(g, p, D, 10); go(g, p, R, 12); go(g, p, U, 8);
  ok(p.alive && !p.trail.length, 'לולאה דרך התפר נסגרה');
  ok(own(g, p, 55, 35) && own(g, p, 1, 36) && !own(g, p, 45, 35) && !own(g, p, 30, 30), 'פנים משני צדי התפר נכבש, השאר לא');
}
{ // מתחם קטן שנוגע בתפר בשני הצירים (סביב הפינה 0,0)
  const g = new Game({ size: 60, rand: seeded(23) });
  const p = g.addPlayer({}); g.spawn(p, { x: 0.5, y: 0.5 });
  go(g, p, R, 7); go(g, p, D, 7); go(g, p, L, 14); go(g, p, U, 14); go(g, p, R, 14); go(g, p, D, 4); go(g, p, L, 6);
  ok(p.alive && !p.trail.length, 'מתחם סביב הפינה נסגר');
  ok(own(g, p, 5, 5) && own(g, p, 55, 55) && own(g, p, 5, 55) && own(g, p, 55, 5), 'ארבעת הרבעים סביב הפינה נכבשו');
  ok(!own(g, p, 30, 30) && g.counts[p.id] * 0.25 < 300, 'שאר המפה לא נכבשה (' + (g.counts[p.id] * 0.25).toFixed(0) + ')');
}
{ // לולאה שמקיפה את כל הטורוס (לא כוויצה) – נכבש רק השובל
  const g = new Game({ size: 40, rand: seeded(24) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  const before = g.counts[p.id];
  go(g, p, R, 40);
  ok(p.alive && !p.trail.length, 'סיבוב שלם סביב הטורוס חזר הביתה');
  const gained = (g.counts[p.id] - before) * 0.25;
  ok(own(g, p, 2, 20) && !own(g, p, 2, 10) && !own(g, p, 2, 30) && gained < 60, 'רק רצועת השובל נכבשה (' + gained.toFixed(0) + ' יח"ר)');
  // סגירה שנייה של רצועה מקבילה: עכשיו יש שתי רצועות => פיצול => הרצועה הקטנה ביניהן נכבשת
  go(g, p, U, 6); go(g, p, R, 38); go(g, p, D, 6);
  ok(p.alive && own(g, p, 5, 16) && own(g, p, 33, 17) && !own(g, p, 5, 30) && !own(g, p, 20, 5), 'שתי רצועות: הרצועה הקטנה ביניהן נכבשה, הגדולה לא');
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
  for (let i = 0; i < 20 && d.alive; i++) { c.h = c.target = R; d.h = d.target = L; g2.step(); }
  ok(c.alive && !d.alive && c.kills === 1, 'מי שבתוך השטח שלו שורד');
}

// מימוש ייחוס נאיבי לכלל הטורוס v9.6: רכיבי קשירות; כל הרכיבים בגודל המקסימלי נשארים (תיקו)
function reference(owner, G, id) {
  const comp = new Int32Array(G * G).fill(-1), sizes = [];
  for (let s0 = 0; s0 < G * G; s0++) {
    if (owner[s0] === id || comp[s0] >= 0) continue;
    const c = sizes.length, st = [s0]; comp[s0] = c; let n = 0;
    while (st.length) { const k = st.pop(), x = k % G, y = (k - x) / G; n++;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const j = ((ny + G) % G) * G + (nx + G) % G; if (owner[j] !== id && comp[j] < 0) { comp[j] = c; st.push(j); } } }
    sizes.push(n);
  }
  let maxSz = 0; for (let c = 0; c < sizes.length; c++) if (sizes[c] > maxSz) maxSz = sizes[c];
  const out = new Uint8Array(G * G);
  for (let k = 0; k < G * G; k++) {
    if (owner[k] === id) { out[k] = 1; continue; }
    out[k] = sizes.length > 1 && sizes[comp[k]] < maxSz ? 1 : 0;
  }
  return out;
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
        const lx = snapTrail[snapTrail.length - 2], ly = snapTrail[snapTrail.length - 1];
        const tr = snapTrail.concat([lx + Game.wrapDelta(p.x - lx, 40), ly + Game.wrapDelta(p.y - ly, 40)]);
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
  const ticks = 12000; // 200 שניות משחק ב-60 צעדים לשנייה
  for (let s = 0; s < ticks; s++) {
    for (const p of g.players) if (p.alive && (g.tickNo + p.id) % g.AI_EVERY === 0) AI.think(g, p, lvl);
    g.step();
    for (const e of g.events) { if (e.type === 'death') { deaths++; reasons[e.reason] = (reasons[e.reason] || 0) + 1; } if (e.type === 'capture') captures++; }
    g.events.length = 0;
    if (s % 80 === 0) for (const p of g.players) if (!p.alive) g.spawn(p);
  }
  const c = new Int32Array(32); for (let i = 0; i < g.owner.length; i++) c[g.owner[i]]++;
  let cons = true; for (let k = 1; k <= 8; k++) if (c[k] !== g.counts[k]) cons = false;
  const ms = Date.now() - t0;
  ok(cons && captures > 200 && deaths < captures / 3, `${lvl}: ${captures} כיבושים, ${deaths} מיתות ${JSON.stringify(reasons)}, ${(ms / ticks).toFixed(2)}ms לצעד, שטח מקס' ${Math.max(...g.players.map(p => p.bestPct)).toFixed(1)}%`);
}

// ---------- v8: איים והולדה בטוחה ----------
function ownComps(g, id) { // מספר רכיבי הקשירות של השטח של id (4 שכנים, עוטף) – מימוש נאיבי
  const G = g.G, seen = new Uint8Array(G * G); let c = 0;
  for (let s0 = 0; s0 < G * G; s0++) { if (g.owner[s0] !== id || seen[s0]) continue; c++; const st = [s0]; seen[s0] = 1;
    while (st.length) { const k = st.pop(), x = k % G, y = (k - x) / G;
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) { const j = ((ny+G)%G)*G + (nx+G)%G; if (g.owner[j] === id && !seen[j]) { seen[j] = 1; st.push(j); } } } }
  return c;
}
function rect(g, id, x0, y0, x1, y1) { for (let y = y0; y < y1; y += g.CELL) for (let x = x0; x < x1; x += g.CELL) g.setOwner(g.cellAt(x + 0.01, y + 0.01), id); }
const realCount = (g, id) => { let n = 0; for (const v of g.owner) if (v === id) n++; return n; };
console.log('v8: איים');
{ // כיבוש אמיתי שחותך את השטח של א' לשניים – החלק בלי הדמות נעלם
  const g = new Game({ size: 80, rand: seeded(31) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 12, y: 12 }); rect(g, a.id, 8, 9, 34, 15);
  g.spawn(b, { x: 22, y: 30 }); g._lost.fill(0);
  const before = g.counts[a.id];
  // א' "עומד" בבית: מחזירים אותו לנקודה (12,12) אחרי כל צעד
  const goB = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && b.alive; i++) { b.h = b.target = ang; g.step(); a.x = a.px = 12; a.y = a.py = 12; a.trail = []; } };
  goB(U, 26); goB(R, 2.5); goB(D, 25);
  ok(b.alive && !b.trail.length && own(g, b, 23, 12), 'ב\' כבש רצועה דרך השטח של א\'');
  ok(ownComps(g, a.id) === 1 && own(g, a, 12, 12) && !own(g, a, 31, 12) && g.ownerAt(31, 12) === 0, 'החלק המנותק של א\' (בלי הדמות) נעלם והפך לניטרלי');
  ok(g.counts[a.id] === realCount(g, a.id) && g.counts[a.id] < before / 2 + 60, 'הספירה (וה-%) של א\' עודכנה: ' + before + ' → ' + g.counts[a.id]);
}
// להקפאה: שחקן שלא זז
function frozen(p) { p.speed = 0; }
{ // אי שחוצה את התפר
  const g = new Game({ size: 80, rand: seeded(32) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 66, y: 40 }); rect(g, a.id, 62, 37, 80, 43); rect(g, a.id, 0, 37, 10, 43);
  g.spawn(b, { x: 40, y: 10 }); g._lost.fill(0);
  rect(g, b.id, 70, 30, 72, 50);            // ב' "כובש" רצועה אנכית – החלק 72..90 (חוצה את x=0) מנותק
  g.pruneIslands();
  ok(own(g, a, 66, 40) && !own(g, a, 76, 40) && !own(g, a, 5, 40) && ownComps(g, a.id) === 1 && g.counts[a.id] === realCount(g, a.id), 'אי שחוצה את התפר נעלם בשלמותו');
}
{ // שחקן בחוץ עם שובל שומר את הרכיב שממנו יצא, גם אם הוא הקטן
  const g = new Game({ size: 80, rand: seeded(33) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 12, y: 40 }); rect(g, a.id, 14, 37, 50, 43);
  g.spawn(b, { x: 40, y: 10 });
  go(g, a, U, 6); // יוצא מלמעלה – שובל מתחיל ליד (12,~37)
  ok(a.alive && a.trail.length > 0, 'א\' בחוץ עם שובל');
  g._lost.fill(0);
  rect(g, b.id, 18, 30, 20, 50); g.pruneIslands();   // חותך: שמאל קטן (העוגן) / ימין גדול
  ok(own(g, a, 12, 40) && !own(g, a, 40, 40) && ownComps(g, a.id) === 1, 'נשאר רכיב העוגן (ממנו השובל יצא), לא הגדול');
  go(g, a, R, 2); go(g, a, D, 7);
  ok(a.alive && !a.trail.length, 'וחזרה אליו סוגרת לולאה כרגיל');
}

console.log('v8/v9.6: נכלא בתוך לולאה');
{ // v9.9: smaller pocket fills, occupant dies, remote territory is removed.
  const g = new Game({ size: 80, rand: seeded(61) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  const beforeB = g.counts[b.id];
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); if (b.alive) { b.x = b.px = 28; b.y = b.py = 25; b.trail = []; b.h = b.target = 0; } } };
  goA(R, 14); goA(D, 10); goA(L, 14); goA(U, 8);
  ok(a.alive && !b.alive && a.kills === 1, 'v9.9: enclosed head eliminated, credited to captor');
  ok(g.counts[b.id] === 0 && own(g, a, 28, 25), 'pocket filled and victim remote territory removed');
}
{ // מחוץ ללולאה – לא נפגע
  const g = new Game({ size: 80, rand: seeded(62) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); b.x = b.px = 45; b.y = b.py = 25; b.trail = []; } };
  goA(R, 14); goA(D, 10); goA(L, 14); goA(U, 8);
  ok(a.alive && b.alive && g.counts[b.id] > 0, 'מחוץ ללולאה – לא נפגע');
}
{ // Enclosure crossing the seam uses the same capture/elimination rule.
  const g = new Game({ size: 80, rand: seeded(63) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 72, y: 20 }); g.spawn(b, { x: 40, y: 60 });
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); if (b.alive) { b.x = b.px = 0.1; b.y = b.py = 25; b.trail = []; } } };
  goA(R, 16); goA(D, 10); goA(L, 16); goA(U, 8);
  ok(a.alive && !b.alive && a.kills === 1, 'v9.9: enclosed head on seam eliminated');
}
{ // v9.6: ראש על רצועת השובל עצמה – התא מוטבע, enclosed נפסל כרגיל
  const g = new Game({ size: 80, rand: seeded(64) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  // בונים ל-a טבעת ואז חותכים עם קו שעובר על ראש b
  for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === a.id) g.setOwner(i, 0);
  function rect(g, id, x0, y0, x1, y1) { for (let y = y0; y < y1; y += g.CELL) for (let x = x0; x < x1; x += g.CELL) g.setOwner(g.cellAt(x + 0.01, y + 0.01), id); }
  rect(g, a.id, 10, 10, 40, 40);
  for (let y = 16; y < 34; y += g.CELL) for (let x = 16; x < 34; x += g.CELL) g.setOwner(g.cellAt(x + 0.01, y + 0.01), 0);
  b.x = 25; b.y = 25; b.alive = true; b.trail = [];
  a.x = 12; a.y = 25; a.alive = true;
  const pts = []; for (let i = 0; i <= 40; i++) pts.push(12 + i * 0.65, 25);
  a.trail = pts; a.x = pts[pts.length - 2]; a.y = pts[pts.length - 1];
  let ev = null; const beforeEvents = g.events.length;
  g.capture(a);
  for (const e of g.events) if (e.type === 'death' && e.victim === b) ev = e;
  ok(!b.alive && ev && ev.reason === 'enclosed' && ev.killer === a, 'ראש על השובל: נכלא כרגיל (enclosed)');
  ok(g.counts[b.id] === 0, 'שטח B נמחק אחרי enclosed');
}
console.log('v9.14: נכלא גם כשעמד על השטח של הכובש');
// A: בסיס + רצועה (חצי-אי) ימינה. A יוצא, מקיף את קצה הרצועה וחוזר. B עומד על הרצועה בתוך הלולאה.
function stripScene(seed, pinB, opts) {
  opts = opts || {};
  const g = new Game({ size: 80, rand: seeded(seed) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  rect(g, a.id, 20, 24.5, 34, 26); rect(g, a.id, 18, 21, 22, 26);
  if (opts.big) rect(g, a.id, 4, 4, 20, 20);
  if (opts.before) opts.before(g, a, b);
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); if (b.alive) pinB(g, b); } };
  goA(R, 18); goA(D, 10); goA(L, 18); goA(U, 5);
  return { g, a, b };
}
const pinOn = (x, y) => (g, b) => { b.x = b.px = x; b.y = b.py = y; b.trail = [x + 1.5, y, x, y]; b.tb = [x, y, x + 1.5, y]; b.h = b.target = L; };
{ // החור: הראש על תא שכבר היה של A (heads[k+2] === p.id) – בעבר דולג ונשאר חי בתוך השטח
  const { g, a, b } = stripScene(71, pinOn(32, 25.2));
  const ev = g.events.find(e => e.type === 'death' && e.victim === b);
  ok(a.alive && !a.trail.length && !b.alive && ev && ev.reason === 'enclosed' && ev.killer === a && a.kills === 1, 'v9.14: עומד על רצועה של הכובש בתוך הלולאה – נכלא ונפסל (enclosed)');
  ok(g.counts[b.id] === 0, 'v9.14: השטח של הנכלא נמחק');
}
{ // שליטה: עומד על השטח של הכובש מחוץ ללולאה (בסיס גדול, רחוק) – לא נפגע
  const { g, a, b } = stripScene(72, pinOn(8, 8), { big: true });
  ok(a.alive && !a.trail.length && b.alive && g.counts[b.id] > 0, 'v9.14: עומד על השטח של הכובש רחוק מהלולאה – לא נפגע');
}
{ // שליטה: עומד על השטח של הכובש ממש ליד הלולאה אבל מחוץ לה (צד שמאל של הבסיס)
  const { g, a, b } = stripScene(73, pinOn(18.5, 23));
  ok(a.alive && !a.trail.length && b.alive, 'v9.14: על השטח של הכובש צמוד ללולאה אבל בחוץ – לא נפגע');
}
{ // שליטה: על הרצועה של הכובש בחלק שמחוץ ללולאה? (הרצועה כולה בפנים) – בודקים גם מישהו בשטח פנוי מחוץ ללולאה
  const { g, a, b } = stripScene(74, (g, b) => { b.x = b.px = 50; b.y = b.py = 25; b.trail = []; });
  ok(a.alive && b.alive, 'v9.14: שחקן בחוץ (שטח פנוי) – לא נפגע');
}
{ // אותו דבר מעבר לתפר: הבסיס והרצועה חוצים את x=0
  const g = new Game({ size: 80, rand: seeded(75) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 70, y: 20 }); g.spawn(b, { x: 40, y: 60 });
  rect(g, a.id, 70, 24.5, 80, 26); rect(g, a.id, 0, 24.5, 4, 26); rect(g, a.id, 68, 21, 72, 26);
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); if (b.alive) pinOn(2, 25.2)(g, b); } };
  goA(R, 18); goA(D, 10); goA(L, 18); goA(U, 5);
  ok(a.alive && !a.trail.length && !b.alive && a.kills === 1, 'v9.14: עומד על רצועה של הכובש מעבר לתפר – נכלא');
}
{ // B על האי של עצמו, A מקיף את כל האי – התאים של B עוברים ל-A ו-B נפסל
  const g = new Game({ size: 80, rand: seeded(76) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 });
  for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === b.id) g.setOwner(i, 0);
  rect(g, b.id, 27, 23, 31, 27); g._lost.fill(0);
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); if (b.alive) { b.x = b.px = 29; b.y = b.py = 25; b.trail = []; } } };
  goA(R, 16); goA(D, 12); goA(L, 16); goA(U, 10);
  const ev = g.events.find(e => e.type === 'death' && e.victim === b);
  ok(a.alive && !b.alive && ev && (ev.reason === 'enclosed' || ev.reason === 'territory') && g.counts[b.id] === 0 && own(g, a, 29, 25), 'v9.14: אי שלם של B מוקף – נלקח ו-B נפסל (' + (ev && ev.reason) + ')');
}
{ // כיבוש במקום אחר לא מוחק את כל מי שעל השטח של הכובש: כמה שחקנים על הבסיס הגדול
  const g = new Game({ size: 80, rand: seeded(77) });
  const a = g.addPlayer({}), b = g.addPlayer({}), c = g.addPlayer({});
  g.spawn(a, { x: 20, y: 20 }); g.spawn(b, { x: 60, y: 60 }); g.spawn(c, { x: 60, y: 20 });
  rect(g, a.id, 6, 6, 24, 24);
  const pin = () => { if (b.alive) { b.x = b.px = 8; b.y = b.py = 8; b.trail = [9, 8, 8, 8]; } if (c.alive) { c.x = c.px = 21.5; c.y = c.py = 22; c.trail = [21.5, 23, 21.5, 22]; } };
  const goA = (ang, dist) => { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && a.alive; i++) { a.h = a.target = ang; g.step(); pin(); } };
  goA(R, 10); goA(D, 8); goA(L, 7.5); goA(U, 6);
  ok(a.alive && !a.trail.length && g.counts[a.id] > 18 * 18 * 4 && b.alive && c.alive, 'v9.14: לולאה בצד הבסיס – השחקנים על הבסיס רחוק ממנה לא נפגעים');
}
console.log('v8: הולדה בטוחה');
{
  const g = new Game({ size: 100, rand: seeded(41) });
  const ps = []; for (let i = 0; i < 6; i++) { const p = g.addPlayer({ isBot: true }); g.spawn(p); ps.push(p); }
  let minHead = Infinity, minTerr = Infinity;
  for (let i = 0; i < ps.length; i++) for (let j = 0; j < i; j++) minHead = Math.min(minHead, Math.sqrt(g.dist2(ps[i].x, ps[i].y, ps[j].x, ps[j].y)));
  ok(minHead >= 15, 'מפה ריקה: מרחק בין ראשים ≥15 (' + minHead.toFixed(1) + ')');
  ok(g.lastSpawnScore >= 1, 'מפה ריקה: נמצא מקום שעומד בכל הדרישות (ציון ' + g.lastSpawnScore.toFixed(2) + ')');
}
{ // מפה צפופה: הולדה לא דורסת שטח ולא חותכת שובל
  const g = new Game({ size: 40, rand: seeded(42) });
  const ps = []; for (let i = 0; i < 8; i++) { const p = g.addPlayer({ isBot: true }); g.spawn(p); ps.push(p); }
  for (let s = 0; s < 600; s++) { for (const p of ps) if (p.alive && (g.tickNo + p.id) % 2 === 0) AI.think(g, p, 'normal'); g.step(); g.events.length = 0; }
  let overwritten = 0, trailCut = 0, spawns = 0;
  for (const p of ps) {
    if (p.alive) g.kill(p, null, 'test');
    const snap = g.owner.slice(), trails = ps.map(q => q.trail.slice());
    g.spawn(p); spawns++;
    for (let i = 0; i < snap.length; i++) if (snap[i] && snap[i] !== g.owner[i]) overwritten++;
    ps.forEach((q, k) => { if (q !== p && q.trail.length !== trails[k].length) trailCut++; });
  }
  ok(spawns === 8 && overwritten === 0 && trailCut === 0, 'מפה צפופה: ' + spawns + ' הולדות, 0 תאים זרים נדרסו, 0 שובלים נפגעו');
  ok(ps.every(p => p.alive && g.counts[p.id] > 0), 'כולם נולדו עם שטח');
}
console.log('v8: סימולציה ארוכה – אין איים');
{
  const g = new Game({ size: 80, rand: seeded(51) });
  for (let i = 0; i < 8; i++) g.spawn(g.addPlayer({ isBot: true }));
  let bad = 0, islandsRemoved = 0, captures = 0, countBad = 0;
  for (let s = 0; s < 6000; s++) {
    for (const p of g.players) if (p.alive && (g.tickNo + p.id) % 2 === 0) AI.think(g, p, 'hard');
    g.step();
    for (const e of g.events) { if (e.type === 'island') islandsRemoved++; if (e.type === 'capture') captures++; }
    g.events.length = 0;
    if (s % 3 === 0) for (const p of g.players) { if (g.counts[p.id] > 0 && ownComps(g, p.id) !== 1) bad++; }
    if (s % 300 === 0) for (const p of g.players) if (g.counts[p.id] !== realCount(g, p.id)) countBad++;
    if (s % 60 === 0) for (const p of g.players) if (!p.alive) g.spawn(p);
  }
  ok(bad === 0 && countBad === 0, '6000 צעדים, 8 בוטים קשים: כל שטח הוא רכיב אחד בכל בדיקה (' + captures + ' כיבושים, ' + islandsRemoved + ' איים הוסרו)');
}
console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
