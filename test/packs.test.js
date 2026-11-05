// v9.5: בדיקות חבילות הפתעה – רישום אפקטים, הופעה, איסוף, תפוגה
const Game = require('../js/game.js');
const Packs = require('../js/packs.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } }
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

console.log('רישום אפקטים');
ok(Packs.EFFECT_IDS.length >= 4, 'לפחות 4 אפקטים בטבלה');
ok(!!Packs.effect('speed') && Packs.effect('speed').speedMul > 1, 'האצה מגדילה מהירות');
ok(!!Packs.effect('slow') && Packs.effect('slow').speedMul < 1, 'האטה מקטינה מהירות');
ok(Packs.effect('invert').visual === 'invert', 'היפוך צבעים – visual');
ok(Packs.effect('wide').visual === 'wide', 'שדה ראייה רחב – visual');
ok(!Packs.effect('nolife'), 'אפקט לא קיים → null');
ok(Packs.maxFor(80) >= 2 && Packs.maxFor(130) >= Packs.maxFor(80), 'מספר חבילות גדל עם המפה');

console.log('הופעה ואיסוף');
{
  const rand = seeded(42);
  const g = new Game({ size: 80, rand: rand });
  const p = g.addPlayer({ name: 'A' }); g.spawn(p, { x: 40, y: 40 });
  const packs = new Packs({ rand: rand });
  packs.reset();
  const sp = packs.spawnOne(g, { x: 42, y: 40 });
  ok(!!sp && packs.packs.length === 1, 'חבילה אחת הופיעה');
  ok(packs.events.some(e => e.type === 'spawn' && e.pack.id === sp.id), 'אירוע spawn בלי סוג אפקט גלוי ללקוח');
  ok(!('effectId' in packs.events.find(e => e.type === 'spawn').pack), 'באירוע הרשת לא נשלח effectId');
  // קרב לחבילה
  p.x = sp.x; p.y = sp.y; p.alive = true;
  packs.events.length = 0;
  packs.tick(g);
  ok(packs.packs.length === 0, 'אחרי איסוף – החבילה נעלמה');
  ok(!!packs.activeOf(p.id), 'אפקט פעיל על האוסף');
  ok(p.speedMul === packs.speedMul(p.id), 'speedMul על השחקן');
  const pickEv = packs.events.find(e => e.type === 'pick');
  ok(pickEv && pickEv.effectId && pickEv.playerId === p.id, 'אירוע pick עם סוג אפקט');
}

console.log('תפוגה ומהירות בסימולציה');
{
  const rand = seeded(7);
  const g = new Game({ size: 60, rand: rand });
  const p = g.addPlayer({}); g.spawn(p, { x: 30, y: 30 });
  const packs = new Packs({ rand: rand });
  packs.reset();
  packs.apply(g, p, 'speed', g.tickNo);
  ok(p.speedMul > 1, 'האצה הוחלה');
  const x0 = p.x;
  p.h = p.target = 0;
  for (let i = 0; i < 60; i++) g.step();
  const distFast = Math.abs(Game.wrapDelta(p.x - x0, g.W));
  // תפוגה כפויה
  packs.active[p.id].until = g.tickNo;
  packs.tick(g);
  ok(!packs.activeOf(p.id) && p.speedMul === 1, 'אחרי תפוגה – מהירות רגילה');
  const x1 = p.x;
  for (let i = 0; i < 60; i++) g.step();
  const distNorm = Math.abs(Game.wrapDelta(p.x - x1, g.W));
  ok(distFast > distNorm * 1.2, 'במהירות מוגברת עבר יותר דרך (' + distFast.toFixed(1) + ' > ' + distNorm.toFixed(1) + ')');
}

console.log('לא על ראש שחקן + תקרת כמות');
{
  const rand = seeded(99);
  const g = new Game({ size: 80, rand: rand });
  const p = g.addPlayer({}); g.spawn(p, { x: 40, y: 40 });
  const packs = new Packs({ rand: rand });
  packs.reset();
  let near = 0;
  for (let i = 0; i < 20; i++) {
    const sp = packs.spawnOne(g);
    if (!sp) break;
    if (Math.sqrt(g.dist2(sp.x, sp.y, p.x, p.y)) < 4) near++;
  }
  ok(near === 0, 'אף חבילה לא על הראש');
  ok(packs.packs.length <= Packs.maxFor(g.W), 'לא עוברים את התקרה (' + packs.packs.length + '/' + Packs.maxFor(g.W) + ')');
}

console.log('בוט יכול לאסוף');
{
  const rand = seeded(3);
  const g = new Game({ size: 80, rand: rand });
  const bot = g.addPlayer({ name: 'B', isBot: true }); g.spawn(bot, { x: 20, y: 20 });
  const packs = new Packs({ rand: rand });
  const sp = packs.spawnOne(g, { x: 20.5, y: 20 });
  bot.x = sp.x; bot.y = sp.y;
  packs.tick(g);
  ok(!!packs.activeOf(bot.id), 'בוט אסף חבילה');
}

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
