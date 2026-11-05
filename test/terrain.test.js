// v9.7 – קונטורי שטח בטורוס: node test/terrain.test.js
const Game = require('../js/game.js');
const Terrain = require('../js/terrain.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } }
function rect(g, id, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y += g.CELL) for (let x = x0; x < x1; x += g.CELL)
    g.setOwner(g.cellAt(x + 0.01, y + 0.01), id);
}
function clearId(g, id) { for (let i = 0; i < g.owner.length; i++) if (g.owner[i] === id) g.setOwner(i, 0); }

console.log('v9.7 קונטור: צלב מלא (שני צירים) – פנים = שטח, לא משלים');
{
  const g = new Game({ size: 40 });
  const me = g.addPlayer({}), bot = g.addPlayer({});
  g.spawn(me, { x: 20, y: 20 }); g.spawn(bot, { x: 5, y: 5 });
  clearId(g, me.id);
  rect(g, me.id, 19, 0, 21, 40);
  rect(g, me.id, 0, 19, 40, 21);
  rect(g, bot.id, 2, 2, 10, 10);
  const loops = Terrain.contours(g.owner, g.G, g.CELL, me.id);
  ok(loops.length >= 1, 'יש לפחות לולאה אחת (' + loops.length + ')');
  ok(Terrain.pointInLoops(loops, 20.25, 20.25), 'מרכז הצלב בתוך הקונטור');
  ok(Terrain.pointInLoops(loops, 20.25, 5.25), 'זרוע אנכית בתוך הקונטור');
  ok(Terrain.pointInLoops(loops, 5.25, 20.25), 'זרוע אופקית בתוך הקונטור');
  ok(!Terrain.pointInLoops(loops, 10, 10), 'רביע ריק מחוץ לקונטור');
  ok(!Terrain.pointInLoops(loops, 30, 30), 'רביע נגדי ריק מחוץ לקונטור');
  ok(g.ownerAt(5, 5) === bot.id && g.counts[bot.id] > 0, 'שטח יריב ברשת לא נמחק');
  const meCells = g.counts[me.id], pct = 100 * meCells / g.owner.length;
  ok(pct > 5 && pct < 20, 'אחוז הצלב סביר (' + pct.toFixed(1) + '%) – לא היפוך ל-~50%+ מהמפה');
}

console.log('v9.7 קונטור: צלב עם פער דק');
{
  const g = new Game({ size: 40 });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 }); clearId(g, p.id);
  rect(g, p.id, 19, 0, 21, 40); rect(g, p.id, 0, 19, 40, 21);
  for (let x = 19; x < 21; x += g.CELL) g.setOwner(g.cellAt(x + 0.01, 12.01), 0);
  const loops = Terrain.contours(g.owner, g.G, g.CELL, p.id);
  ok(Terrain.pointInLoops(loops, 20.25, 20.25), 'מרכז עדיין בפנים אחרי פער');
  ok(!Terrain.pointInLoops(loops, 10, 10), 'חור לא התמלא בקונטור');
  // פער של תא אחד עלול להיסגר בהחלקה – חשוב שהרביעים הריקים יישארו בחוץ
  ok(!Terrain.pointInLoops(loops, 8, 8) && !Terrain.pointInLoops(loops, 32, 32), 'רביעים ריקים נשארים מחוץ אחרי פער');
}

console.log('v9.7 קונטור: לולאה רגילה + רצועה אנכית לא נשברו');
{
  const g = new Game({ size: 40 });
  const p = g.addPlayer({}); g.spawn(p, { x: 20, y: 20 });
  rect(g, p.id, 15, 15, 25, 25);
  const blob = Terrain.contours(g.owner, g.G, g.CELL, p.id);
  ok(blob.length === 1 && !(blob[0].D && (blob[0].D[0] || blob[0].D[1])), 'blob = לולאה חוזית אחת');
  ok(Terrain.pointInLoops(blob, 20, 20) && !Terrain.pointInLoops(blob, 5, 5), 'blob: פנים/חוץ');

  clearId(g, p.id); rect(g, p.id, 19, 0, 21, 40);
  const band = Terrain.contours(g.owner, g.G, g.CELL, p.id);
  ok(band.length === 2 && band.every(L => L.D && L.D[1]), 'רצועה אנכית = 2 לולאות עם D אנכי');
}

console.log('\nסיכום terrain: ' + pass + ' עברו, ' + fail + ' נכשלו');
if (fail) process.exit(1);
