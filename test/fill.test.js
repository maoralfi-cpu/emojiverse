// v9.6 – בדיקות לוגיקת מילוי טורוס (Qix): node test/fill.test.js
const Game = require('../js/game.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = 0, D = Math.PI / 2, L = Math.PI, U = -Math.PI / 2;
function go(g, p, ang, dist) { const n = Math.round(dist / (g.SPEED * g.DT)); for (let i = 0; i < n && p.alive; i++) { p.h = p.target = ang; g.step(); } }
const own = (g, p, x, y) => g.ownerAt(x, y) === p.id;
function rect(g, id, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y += g.CELL) for (let x = x0; x < x1; x += g.CELL)
    g.setOwner(g.cellAt(x + 0.01, y + 0.01), id);
}
/** בונה שובל קו ישר ומפעיל capture ישירות (בלי לנוע). */
function closeLine(g, p, x0, y0, x1, y1) {
  const pts = [];
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.ceil(len / 0.4));
  for (let i = 0; i <= steps; i++) {
    pts.push(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
  }
  p.x = x1; p.y = y1; p.trail = pts;
  return g.capture(p);
}

console.log('v9.6 מילוי: לולאה פשוטה');
{
  const g = new Game({ size: 60, rand: seeded(1) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  go(g, p, R, 12); go(g, p, D, 10); go(g, p, L, 12); go(g, p, U, 8);
  ok(p.alive && !p.trail.length, 'הלולאה נסגרה');
  ok(own(g, p, 26, 25) && own(g, p, 30, 27), 'פנים הלולאה נכבש');
  ok(!own(g, p, 36, 25) && !own(g, p, 26, 33) && !own(g, p, 10, 10), 'מחוץ ללולאה לא נכבש');
}

console.log('v9.6 מילוי: חור בסופגנייה שנחצה בקו – כל החור מתמלא');
{
  const g = new Game({ size: 60, rand: seeded(2) });
  const p = g.addPlayer({}); g.spawn(p, { x: 30, y: 30 });
  // טבעת: מלבן חיצוני פחות חור פנימי
  rect(g, p.id, 10, 10, 50, 50);
  for (let y = 18; y < 42; y += g.CELL) for (let x = 18; x < 42; x += g.CELL)
    g.setOwner(g.cellAt(x + 0.01, y + 0.01), 0);
  // מוודאים שהחור ריק והטבעת שלנו
  ok(!own(g, p, 30, 30) && own(g, p, 12, 12) && own(g, p, 48, 30), 'סופגנייה: חור ריק, טבעת שלנו');
  const beforeHole = [...g.owner].filter((o, i) => {
    const x = (i % g.G) * g.CELL, y = Math.floor(i / g.G) * g.CELL;
    return x >= 18 && x < 42 && y >= 18 && y < 42;
  }).every(o => o === 0);
  ok(beforeHole, 'לפני החיתוך כל תאי החור ניטרליים');
  // קו אופקי חוצה את החור, מקצה הטבעת לקצה – נסגר לשטח
  p.x = 14; p.y = 30;
  const gained = closeLine(g, p, 14, 30, 46, 30);
  ok(gained > 100, 'חציית החור מילאה תאים (' + gained + ')');
  ok(own(g, p, 30, 25) && own(g, p, 30, 35) && own(g, p, 25, 30) && own(g, p, 35, 30),
    'כל החור (שני הצדדים של הקו) נכבש');
  ok(!own(g, p, 5, 5) && !own(g, p, 55, 55), 'מחוץ לטבעת לא נכבש');
}

console.log('v9.6 מילוי: רצועה אנכית מלאה = בלי מילוי');
{
  const g = new Game({ size: 40, rand: seeded(3) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  const before = g.counts[p.id];
  go(g, p, U, 40); // סיבוב אנכי שלם סביב הטורוס
  ok(p.alive && !p.trail.length, 'רצועה אנכית נסגרה');
  const gained = (g.counts[p.id] - before) * 0.25;
  ok(own(g, p, 20, 2) && own(g, p, 20, 38), 'רצועת השובל קיימת');
  ok(!own(g, p, 5, 20) && !own(g, p, 35, 20) && gained < 80,
    'רצועה אחת לא ממלאה כלום מעבר לשובל (gained=' + gained.toFixed(1) + ')');
}

console.log('v9.6 מילוי: רצועה אנכית + אופקית = בלי מילוי, יציב בסגירות חוזרות');
{
  const g = new Game({ size: 40, rand: seeded(4) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  go(g, p, U, 40); // רצועה אנכית
  const afterV = g.counts[p.id];
  // חוזרים למרכז השטח על הרצועה ויוצרים רצועה אופקית
  p.x = 20; p.y = 20; p.trail = [];
  // נוודא שאנחנו על שטח שלנו
  ok(own(g, p, 20, 20), 'עומדים על הרצועה האנכית');
  go(g, p, R, 40); // רצועה אופקית מלאה
  ok(p.alive && !p.trail.length, 'רצועה אופקית נסגרה');
  const afterH = g.counts[p.id];
  const quadEmpty = !own(g, p, 5, 5) && !own(g, p, 5, 35) && !own(g, p, 35, 5) && !own(g, p, 35, 35);
  ok(quadEmpty, 'ארבעת הרבעים נשארו ריקים (אין מילוי אחרי צלב)');
  // הגידול הוא בעיקר רצועת השובל האופקי – לא חצי מפה
  ok((afterH - afterV) * 0.25 < 100, 'הגידול אחרי הצלב קטן (' + ((afterH - afterV) * 0.25).toFixed(1) + ')');

  // סגירות חוזרות: עוד נסיעה קצרה החוצה וחזרה – השטח לא קופץ
  const snap = g.owner.slice();
  const snapCount = g.counts[p.id];
  for (let rep = 0; rep < 3; rep++) {
    go(g, p, U, 3); go(g, p, R, 3); go(g, p, D, 3); go(g, p, L, 4);
    if (!p.alive) break;
  }
  let flipped = 0;
  for (let i = 0; i < snap.length; i++) if ((snap[i] === p.id) !== (g.owner[i] === p.id)) flipped++;
  // מותר שינוי קטן מלולאות מקומיות, אבל לא קפיצה של חצי מפה
  const jump = Math.abs(g.counts[p.id] - snapCount);
  ok(p.alive && jump < g.G * g.G * 0.15 && flipped < g.G * g.G * 0.15,
    'יציב בסגירות חוזרות (שינוי תאים=' + flipped + ', Δcount=' + jump + ')');
  ok(!own(g, p, 5, 5) || !own(g, p, 35, 35), 'לא התהפך לכיבוש מלא של הרבעים');
}

console.log('v9.6 מילוי: רכיב עם ראש יריב לא מתמלא');
{
  const g = new Game({ size: 60, rand: seeded(5) });
  const a = g.addPlayer({ name: 'A' }), b = g.addPlayer({ name: 'B' });
  g.spawn(a, { x: 10, y: 30 });
  g.spawn(b, { x: 50, y: 50 });
  for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === b.id) g.setOwner(i, 0);
  // טבעת של A; חור 24..36. קו החיתוך ב-y=30; ראש B מעל הקו ב-(30,33)
  rect(g, a.id, 18, 18, 42, 42);
  for (let y = 24; y < 36; y += g.CELL) for (let x = 24; x < 36; x += g.CELL)
    g.setOwner(g.cellAt(x + 0.01, y + 0.01), 0);
  b.x = 30; b.y = 33; b.alive = true; b.trail = [];
  rect(g, b.id, 50, 50, 54, 54);   // שטח מרוחק ל-B
  ok(g.ownerAt(30, 33) === 0 && b.alive, 'ראש B בחור ניטרלי (מעל קו החיתוך)');
  a.x = 20; a.y = 30;
  closeLine(g, a, 20, 30, 40, 30);
  ok(!own(g, a, 30, 33) && !own(g, a, 28, 34), 'החצי עם ראש היריב לא התמלא');
  ok(own(g, a, 30, 27) || own(g, a, 28, 26), 'החצי בלי ראש יריב כן התמלא');
  ok(b.alive, 'B עדיין חי (לא נכלא – הראש שמר על הרכיב)');
  ok(own(g, a, 25, 30) && own(g, a, 35, 30), 'רצועת השובל של A כן נכבשה');
}

console.log('v9.6 מילוי: תיקו לגדול ביותר – כולם נשארים בחוץ');
{
  const g = new Game({ size: 40, rand: seeded(6) });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 10 });
  // מנקים את עיגול ההולדה כדי לא לשבור סימטריה, ואז שתי רצועות אופקיות במרחק שווה
  for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === p.id) g.setOwner(i, 0);
  rect(g, p.id, 0, 9, 40, 11);
  rect(g, p.id, 0, 29, 40, 31);
  p.x = 20; p.y = 10; p.alive = true;
  const before = g.counts[p.id];
  const compsBefore = g.components(p.id);
  ok(compsBefore.count === 2 && compsBefore.size[0] === compsBefore.size[1],
    'לפני הסגירה: בדיוק 2 רכיבים בתיקו (' + compsBefore.size.join(',') + ')');
  closeLine(g, p, 18, 10, 22, 10);
  const after = g.counts[p.id];
  ok(!own(g, p, 20, 20) && !own(g, p, 20, 0.5), 'בתיקו אף חצי לא התמלא');
  ok(after - before < 40, 'רק תאי השובל נוספו בתיקו (Δ=' + (after - before) + ')');
}

console.log('v9.6 מילוי: ביצועים על מפה מלאה');
{
  const g = new Game({ size: 100, rand: seeded(7) }); // G=200, n=40000
  const p = g.addPlayer({}); g.spawn(p, { x: 50, y: 50 });
  // טבעת גדולה עם חור – כדי שיהיה מה למלא
  rect(g, p.id, 5, 5, 95, 95);
  for (let y = 25; y < 75; y += g.CELL) for (let x = 25; x < 75; x += g.CELL)
    g.setOwner(g.cellAt(x + 0.01, y + 0.01), 0);
  p.x = 10; p.y = 50;
  const t0 = Date.now();
  const gained = closeLine(g, p, 10, 50, 90, 50);
  const ms = Date.now() - t0;
  ok(gained > 1000, 'מילוי משמעותי על מפה מלאה (gained=' + gained + ')');
  ok(ms < 80, 'מילוי אחד על מפה 100 תוך ' + ms + 'ms (סף 80ms)');
  console.log('  ⏱ מילוי מפה מלאה: ' + ms + 'ms, gained=' + gained + ' תאים');
}

console.log('\nסיכום fill: ' + pass + ' עברו, ' + fail + ' נכשלו');
if (fail) process.exit(1);
