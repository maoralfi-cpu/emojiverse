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

console.log('v9.19: ארבע ההפתעות החדשות');
{
  ['ice', 'ghost', 'dark', 'radar'].forEach(function (id) {
    const e = Packs.effect(id);
    ok(e && e.emoji && e.duration >= 5 && e.duration <= 8, id + ': קיים במנגנון עם משך 5–8 שנ׳');
  });
  // קרח: פנייה איטית + כיוון תנועה נגרר; תפוגה מחזירה למצב רגיל
  function turnRun(ice, speed) {
    const g = new Game({ size: 80, rand: seeded(5), speed: speed });
    const p = g.addPlayer({}); g.spawn(p, { x: 40, y: 40 });
    const packs = new Packs({ rand: seeded(5) }); packs.reset();
    p.h = p.target = p.mh = 0;
    if (ice) packs.apply(g, p, 'ice', g.tickNo);
    p.target = Math.PI / 2;
    for (let i = 0; i < 10; i++) g.step();
    const moveAng = Math.atan2(Game.wrapDelta(p.y - p.py, g.W), Game.wrapDelta(p.x - p.px, g.W));
    return { p, g, packs, h: p.h, slip: Math.abs(Game.angDiff(p.h, moveAng)) };
  }
  const n = turnRun(false), ic = turnRun(true);
  ok(ic.h < n.h * 0.7, 'קרח: מסתובב לאט יותר (' + ic.h.toFixed(2) + ' < ' + n.h.toFixed(2) + ')');
  ok(n.slip < 1e-6 && ic.slip > 0.05, 'קרח: כיוון התנועה מחליק אחרי הדמות (' + ic.slip.toFixed(2) + ')');
  const f = turnRun(true, Game.speedFor('fast'));
  ok(isFinite(f.p.x) && f.p.ice, 'קרח עובד גם במצב מהיר');
  ic.packs.active[ic.p.id].until = ic.g.tickNo; ic.packs.tick(ic.g);
  ok(!ic.p.ice && ic.p.speedMul === 1, 'קרח: אחרי תפוגה חוזר לרגיל');
  ic.packs.apply(ic.g, ic.p, 'ice', ic.g.tickNo); ic.packs.clientEnd(ic.g, ic.p.id);
  ok(!ic.p.ice, 'קרח: סיום מהמארח (לקוח) מנקה');
  ic.packs.apply(ic.g, ic.p, 'ice', ic.g.tickNo); ic.packs.apply(ic.g, ic.p, 'dark', ic.g.tickNo);
  ok(!ic.p.ice, 'החלפת אפקט מבטלת קרח');
}

console.log('v9.25: הפתעות חוזרות לקופסאות; מלכודות איסוף גלויות');
{
  const looks = Packs.LOOKS;
  ['speed', 'slow', 'invert', 'wide', 'ice', 'ghost', 'dark', 'radar'].forEach(id => {
    ok(!!looks[id] && looks[id] !== 'gift', id + ' יש משטח (' + looks[id] + ')');
  });
  ok(looks.life === 'heart', '❤️ נשאר לב');
  ok(looks.trap === 'snare' && looks.bomb === 'mine', '🪤/💣 יש משטח (מלכודת/מוקש על הקרקע)');
  ok(Packs.lookOf({ effectId: 'speed' }) === 'boost', 'lookOf(speed)=boost');
  ok(Packs.lookOf({ kind: 'life', effectId: 'life' }) === 'heart', 'lookOf(life)=heart');
  ok(Packs.lookOf({ effectId: '?' }) === 'gift' && Packs.lookOf({ effectId: 'nope' }) === 'gift', 'סוג לא מוכר / סודי → 🎁');
  ok(!Packs.revealForSpeed('fast') && !Packs.revealForSpeed('normal') && !Packs.revealForSpeed(undefined), 'reveal כבוי גם במצב אקסטרים (id: fast)');

  const g = new Game({ size: 80, rand: seeded(1) });
  const pl = g.addPlayer({}); g.spawn(pl, { x: 10, y: 10 });
  const packs = new Packs({ rand: seeded(1) }); packs.reset();
  const hidden = packs.spawnOne(g, { x: 40, y: 40 });
  const ev0 = packs.events.find(e => e.type === 'spawn');
  ok(ev0 && !('effectId' in ev0.pack), 'מצב רגיל: אירוע spawn בלי effectId');
  ok(packs.publicList().every(p => !('effectId' in p)), 'מצב רגיל: publicList בלי effectId');

  packs.reset(); packs.setReveal(true);
  const shown = packs.spawnOne(g, { x: 40, y: 40 });
  const ev1 = packs.events.find(e => e.type === 'spawn');
  ok(ev1 && ev1.pack.effectId === shown.effectId, 'אם reveal דולק במכוון: spawn כולל effectId');
  const list = packs.publicList();
  ok(list.length === 1 && list[0].effectId === shown.effectId, 'אם reveal דולק במכוון: publicList כולל effectId');

  packs.reset(); packs.setReveal(Packs.revealForSpeed('fast'));
  packs.spawnOne(g, { x: 40, y: 40 });
  ok(packs.publicList().every(p => !('effectId' in p)), 'מצב אקסטרים: publicList בלי effectId (🎁)');

  const guest = new Packs(); guest.reset(); guest.setReveal(true);
  guest.clientSpawn(7, 20, 21, undefined, 'ice');
  ok(guest.packs[0].effectId === 'ice' && Packs.lookOf(guest.packs[0]) === 'ice', 'אורח מקבל סוג ב-clientSpawn');
  guest.applySync([{ id: 8, x: 1, y: 2, effectId: 'radar' }, { id: 9, x: 3, y: 4 }]);
  ok(guest.packs.find(p => p.id === 8).effectId === 'radar', 'applySync שומר effectId');
  ok(guest.packs.find(p => p.id === 9).effectId === '?', 'בלי effectId – נשאר סודי ולא מנחש speed');

  function stub() {
    const calls = [];
    const rec = (n) => function () { calls.push(n); return this; };
    const ctx = {
      calls,
      texts: [],
      save: rec('save'), restore: rec('restore'),
      beginPath: rec('beginPath'), fill: rec('fill'), stroke: rec('stroke'),
      arc: rec('arc'), ellipse: rec('ellipse'), moveTo: rec('moveTo'),
      lineTo: rec('lineTo'), closePath: rec('closePath'),
      fillRect: rec('fillRect'), rotate: rec('rotate'), translate: rec('translate'),
      scale: rec('scale'), setLineDash: rec('setLineDash'),
      fillText: function (t) { calls.push('fillText'); ctx.texts.push(t); },
      createRadialGradient: function () { return { addColorStop: function () {} }; },
      createLinearGradient: function () { return { addColorStop: function () {} }; },
    };
    let _fs, _ss, _ga, _lw, _font, _ta, _tb, _lj, _lc;
    Object.defineProperties(ctx, {
      fillStyle: { set(v) { _fs = v; calls.push('fillStyle'); }, get() { return _fs; } },
      strokeStyle: { set(v) { _ss = v; calls.push('strokeStyle'); }, get() { return _ss; } },
      globalAlpha: { set(v) { _ga = v; calls.push('alpha'); }, get() { return _ga; } },
      lineWidth: { set(v) { _lw = v; }, get() { return _lw; } },
      font: { set(v) { _font = v; }, get() { return _font; } },
      textAlign: { set(v) { _ta = v; }, get() { return _ta; } },
      textBaseline: { set(v) { _tb = v; }, get() { return _tb; } },
      lineJoin: { set(v) { _lj = v; }, get() { return _lj; } },
      lineCap: { set(v) { _lc = v; }, get() { return _lc; } }
    });
    return ctx;
  }
  const gift = stub();
  Packs.draw(gift, 0, 0, 20, 0, { effectId: 'speed' }, { reveal: false });
  ok(gift.texts.includes('🎁'), 'מצב רגיל: מציירים 🎁 גם להאצה');
  const extreme = stub();
  Packs.draw(extreme, 0, 0, 20, 0, { effectId: 'radar' }, { reveal: Packs.revealForSpeed('fast') });
  ok(extreme.texts.includes('🎁') && !extreme.texts.includes('📡'), 'מצב אקסטרים: הפתעה = 🎁 ולא משטח');
  const traploot = stub();
  Packs.draw(traploot, 0, 0, 20, 0, { kind: 'traploot', effectId: 'trap' }, { reveal: false });
  ok(traploot.texts.includes('🪤') && !traploot.texts.includes('🎁'), 'מלכודת איסוף נשארת גלויה גם בלי reveal');
  const bombloot = stub();
  Packs.draw(bombloot, 0, 0, 20, 0, { kind: 'bombloot', effectId: 'bomb' }, { reveal: false });
  ok(bombloot.texts.includes('💣') && !bombloot.texts.includes('🎁'), 'פצצת איסוף נשארת גלויה גם בלי reveal');
  const heart = stub();
  Packs.draw(heart, 0, 0, 20, 0, { kind: 'life', effectId: 'life' }, { reveal: false });
  ok(heart.texts.includes('❤️'), '❤️ גלוי גם במצב רגיל');
  const boost = stub();
  Packs.draw(boost, 0, 0, 20, 800, { effectId: 'speed' }, { reveal: true });
  ok(!boost.texts.includes('🎁') && boost.texts.includes('⚡') && boost.calls.includes('ellipse'), 'אם reveal דולק במכוון: האצה = מסלול + ⚡ (לא 🎁)');
  const kinds = ['slow', 'invert', 'wide', 'ice', 'ghost', 'dark', 'radar', 'trap', 'bomb'];
  let drew = 0;
  kinds.forEach(id => {
    const c = stub();
    Packs.draw(c, 10, 10, 16, 1200, { effectId: id }, { reveal: true, reduced: true });
    const emo = Packs.effect(id).emoji;
    if (c.calls.includes('save') && c.texts.includes(emo) && !c.texts.includes('🎁')) drew++;
  });
  ok(drew === kinds.length, 'כל הסוגים: משטח + אימוג׳י ברור במרכז (' + drew + '/' + kinds.length + ')');
  ok(Packs.emojiOf({ effectId: 'slow' }) === '🐢' && Packs.emojiOf({ kind: 'life', effectId: 'life' }) === '❤️', 'emojiOf מחזיר את אימוג׳י הסוג');
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
