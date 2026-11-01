// בדיקות לוגיקה: node test/logic.test.js
const Game = require('../js/game.js');
const AI = require('../js/ai.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function drive(g, p, path) { for (const d of path) { if (d !== p.dir) g.turn(p, d); g.step(); } }
const R = 0, D = 1, L = 2, U = 3;

// מימוש ייחוס נאיבי: מילוי מכל גבול המפה על פני תאים שאינם של השחקן
function reference(g, id) {
  const N = g.N, seen = new Uint8Array(N * N), st = [];
  for (let i = 0; i < N; i++) for (const [x, y] of [[i,0],[i,N-1],[0,i],[N-1,i]]) { const k = y*N+x; if (g.owner[k] !== id && !seen[k]) { seen[k] = 1; st.push(k); } }
  while (st.length) { const c = st.pop(), x = c % N, y = (c - x) / N;
    for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) { if (nx<0||ny<0||nx>=N||ny>=N) continue; const k = ny*N+nx; if (!seen[k] && g.owner[k] !== id) { seen[k]=1; st.push(k); } } }
  const out = new Uint8Array(N * N); for (let k = 0; k < N*N; k++) out[k] = (g.owner[k] === id || !seen[k]) ? 1 : 0; return out;
}

console.log('כיבוש לולאה פשוטה');
{
  const g = new Game({ size: 30, rand: seeded(1) });
  const p = g.addPlayer({ name: 'me' });
  g.spawn(p, { x: 10, y: 10 }); p.dir = R; // שטח 8..12
  ok(g.counts[p.id] === 25, 'שטח התחלתי 25 תאים');
  drive(g, p, [R,R,R,R,R, D,D,D,D,D,D, L,L,L,L,L, U,U,U,U]);
  ok(p.alive, 'שחקן חי');
  ok(p.trailCells.length === 0, 'השובל התרוקן אחרי חזרה');
  let all = true; for (let y = 11; y <= 15; y++) for (let x = 11; x <= 14; x++) if (g.owner[g.idx(x,y)] !== p.id) all = false;
  ok(all, 'פנים הלולאה נכבש');
  ok(g.counts[p.id] === 58, 'ספירת תאים = 58 (' + g.counts[p.id] + ')');
  ok(g.owner[g.idx(9, 14)] === 0 && g.owner[g.idx(14, 9)] === 0 && g.owner[g.idx(16, 12)] === 0, 'תאים מחוץ ללולאה לא נכבשו');
}

console.log('כיבוש לאורך קיר המפה');
{
  const g = new Game({ size: 20, rand: seeded(2) });
  const p = g.addPlayer({});
  g.spawn(p, { x: 3, y: 3 }); p.dir = U; // 1..5
  drive(g, p, [U,U,U, R,R,R,R,R,R, D,D,D, L,L,L,L]);
  ok(p.alive && p.trailCells.length === 0, 'חי וחזר');
  ok(g.owner[g.idx(8, 0)] === p.id && g.owner[g.idx(7, 1)] === p.id && g.owner[g.idx(9,3)] === p.id, 'השטח לאורך הקיר נכבש');
  ok(g.owner[g.idx(10, 2)] === 0 && g.owner[g.idx(7, 4)] === 0, 'לא נכבש מעבר');
}

console.log('בור פנימי (חור בתוך השטח) נכבש');
{
  const g = new Game({ size: 30, rand: seeded(3) });
  const p = g.addPlayer({}); g.spawn(p, { x: 15, y: 15 });
  const q = g.addPlayer({}); g.spawn(q, { x: 5, y: 5 });
  for (let y = 12; y <= 18; y++) for (let x = 12; x <= 18; x++) g.setOwner(g.idx(x,y), p.id);
  g.setOwner(g.idx(15,15), q.id);
  p.x = 18; p.y = 15; p.dir = R;
  drive(g, p, [R, D, L]);
  ok(g.owner[g.idx(15,15)] === p.id, 'תא כלוא של יריב נכבש');
}

console.log('התנגשות בשובל');
{
  const g = new Game({ size: 40, rand: seeded(4) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 10, y: 10 }); g.spawn(b, { x: 15, y: 25 });
  a.dir = R; drive(g, a, [R,R,R,R]); // b זז למעלה במקביל
  ok(a.alive && a.trailCells.length === 2, 'a בחוץ עם שובל 2');
  b.x = 13; b.y = 12; b.dir = U; b.trailCells.length = 0;
  for (let i = 0; i < g.trail.length; i++) if (g.trail[i] === b.id) g.trail[i] = 0;
  g.turn(a, D); g.step(); g.step();
  ok(!a.alive, 'a מת כש-b חצה את השובל שלו');
  ok(b.alive && b.kills === 1, 'b קיבל הריגה');
  ok(g.counts[a.id] === 0, 'שטח של a נמחק');
  let t = 0; for (let i = 0; i < g.trail.length; i++) if (g.trail[i] === a.id) t++;
  ok(t === 0, 'השובל של a נמחק');
}

console.log('חציית שובל עצמי');
{
  const g = new Game({ size: 30, rand: seeded(5) });
  const p = g.addPlayer({}); g.spawn(p, { x: 5, y: 5 }); p.dir = R;
  drive(g, p, [R,R,R,R,R,R, D,D, L,L, U,U]);
  ok(!p.alive, 'מת כשנגע בשובל של עצמו');
}

console.log('קיר');
{
  const g = new Game({ size: 20, rand: seeded(6) });
  const p = g.addPlayer({}); g.spawn(p, { x: 3, y: 3 }); p.dir = L;
  drive(g, p, [L,L,L,L]);
  ok(!p.alive, 'מת ביציאה מהמפה');
}

console.log('ראש בראש');
{
  const g = new Game({ size: 40, rand: seeded(7) });
  const a = g.addPlayer({}), b = g.addPlayer({});
  g.spawn(a, { x: 5, y: 20 }); g.spawn(b, { x: 34, y: 20 });
  a.dir = R; b.dir = L;
  g.step(); // תיקו בשטחים
  a.x = 14; b.x = 20; // מזייפים שובלים: a ארוך יותר
  a.trailCells = [1,2,3,4]; b.trailCells = [5,6];
  g.step(); g.step(); g.step(); // a:17 b:17
  ok(!a.alive && b.alive, 'בעל השובל הארוך מת בהתנגשות ראש בראש');
  const g2 = new Game({ size: 40, rand: seeded(8) });
  const c = g2.addPlayer({}), d = g2.addPlayer({});
  g2.spawn(c, { x: 10, y: 10 }); g2.spawn(d, { x: 20, y: 20 });
  c.x = 12; c.y = 10; c.dir = R; d.x = 14; d.y = 10; d.dir = L; d.trailCells = [];
  g2.setOwner(g2.idx(13,10), c.id);
  g2.step();
  ok(c.alive && !d.alive && c.kills === 1, 'מי שבתוך השטח שלו שורד בהתנגשות ראש בראש');
}

console.log('השוואה למימוש ייחוס – 300 לולאות אקראיות');
{
  let good = 0, total = 0;
  for (let t = 0; t < 300; t++) {
    const rnd = seeded(100 + t), g = new Game({ size: 40, rand: rnd });
    const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
    // שטח אקראי מוקדם
    for (let k = 0; k < 6; k++) { const x = 3 + Math.floor(rnd()*34), y = 3 + Math.floor(rnd()*34); for (let yy=y-2; yy<=y+2; yy++) for (let xx=x-2; xx<=x+2; xx++) g.setOwner(g.idx(xx,yy), p.id); }
    let steps = 0;
    while (p.alive && steps++ < 200) {
      const before = p.trailCells.length;
      if (rnd() < 0.25) g.turn(p, Math.floor(rnd()*4));
      const snapshot = g.owner.slice(), trail = p.trailCells.slice();
      const nx = p.x + Game.DX[p.queue.length ? p.queue[0] : p.dir], ny = p.y + Game.DY[p.queue.length ? p.queue[0] : p.dir];
      const willCapture = before > 0 && g.inBounds(nx, ny) && g.owner[g.idx(nx,ny)] === p.id;
      g.step();
      if (willCapture && p.alive) {
        // חישוב ייחוס על המצב הקודם + השובל
        const h = new Game({ size: 40 }); h.owner.set(snapshot); for (const c of trail) h.owner[c] = p.id;
        const ref = reference(h, p.id); let same = true;
        for (let k = 0; k < ref.length; k++) if ((g.owner[k] === p.id ? 1 : 0) !== ref[k]) { same = false; break; }
        total++; if (same) good++;
      }
    }
  }
  ok(total > 50 && good === total, `כיבוש זהה לייחוס ב-${good}/${total} מקרים`);
}

console.log('סימולציית בוטים (3000 צעדים)');
{
  const g = new Game({ size: 100, rand: seeded(9) });
  for (let i = 0; i < 8; i++) { const p = g.addPlayer({ isBot: true }); g.spawn(p); }
  let deaths = 0, captures = 0, t0 = Date.now();
  for (let s = 0; s < 3000; s++) {
    for (const p of g.players) if (p.alive) AI.think(g, p, 'hard');
    g.step();
    for (const e of g.events) { if (e.type === 'death') deaths++; if (e.type === 'capture') captures++; }
    g.events.length = 0;
    for (const p of g.players) if (!p.alive && s % 20 === 0) g.spawn(p);
  }
  // בדיקת עקביות ספירות
  const c = new Int32Array(32); for (let i = 0; i < g.owner.length; i++) c[g.owner[i]]++;
  let cons = true; for (let k = 1; k <= 8; k++) if (c[k] !== g.counts[k]) cons = false;
  ok(cons, 'ספירות שטח עקביות');
  ok(captures > 50, 'בוטים כובשים (' + captures + ' כיבושים, ' + deaths + ' מיתות)');
  ok(deaths < captures, 'בוטים לא מתאבדים כל הזמן');
  console.log('    זמן:', Date.now() - t0, 'ms ; שטח מקסימלי:', Math.max(...g.players.map(p => p.bestPct)).toFixed(1) + '%');
}
console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
