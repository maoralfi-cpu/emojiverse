/* Emojiverse – חבילות הפתעה (v9.5). טבלאת אפקטים + לוגיקת הופעה/איסוף/תפוגה (נבדק ב-node).
   חבילה מוצגת כ-🎁 עד האיסוף. המארח מחליט על הופעה ואיסוף; אפקטים חזותיים מקומיים לאוסף. */
(function (root) {
  'use strict';

  var DURATION = 7;          // שניות (6–8)
  var PICK_R = 1.15;         // רדיוס איסוף (יחידות)
  var HEAD_CLEAR = 4;        // לא על ראש שחקן
  var SPAWN_EVERY = 150;     // ~2.5 שנ' בין ניסיונות הופעה כשיש מקום
  var ICON = '🎁';
  /* v9.13 מצב חיים: חבילת ❤️ גלויה (לא בתוך 🎁). +1 חיים מיד, בלי משך. רק במצב חיים, נדירה יותר. */
  var LIFE = { id: 'life', name: 'חיים נוספים', emoji: '❤️' };
  var HEART_FIRST = 600;     // ~10 שנ' עד הלב הראשון
  var HEART_EVERY = 900;     // ~15 שנ' בין לבבות (מרגע שאין לב במפה)
  var HEART_MAX = 1;         // לב אחד לכל היותר במפה

  /* טבלה/רישום – אפשר להוסיף אפקטים בלי לגעת בלולאה */
  var EFFECTS = {
    speed:  { id: 'speed',  name: 'האצה',           emoji: '⚡', good: true,  duration: DURATION, speedMul: 1.55 },
    slow:   { id: 'slow',   name: 'האטה',           emoji: '🐢', good: false, duration: DURATION, speedMul: 0.55 },
    invert: { id: 'invert', name: 'היפוך צבעים',    emoji: '🌀', good: false, duration: DURATION, visual: 'invert' },
    wide:   { id: 'wide',   name: 'שדה ראייה רחב',  emoji: '🔭', good: true,  duration: DURATION, visual: 'wide' }
  };
  var EFFECT_IDS = Object.keys(EFFECTS);

  function Packs(opts) {
    opts = opts || {};
    this.rand = opts.rand || Math.random;
    this.packs = [];           // { id, x, y, effectId }
    this.nextId = 1;
    this.spawnCD = 0;
    this.active = {};          // playerId -> { effectId, until }
    this.events = [];
    this.lifeStart = 0;        // 0 = מצב סיבובים (אין לבבות)
    this.heartCD = 0;
  }

  Packs.EFFECTS = EFFECTS;
  Packs.EFFECT_IDS = EFFECT_IDS;
  Packs.ICON = ICON;
  Packs.DURATION = DURATION;
  Packs.PICK_R = PICK_R;
  Packs.LIFE = LIFE;
  Packs.HEART_ICON = LIFE.emoji;
  Packs.HEART_EVERY = HEART_EVERY;

  Packs.maxFor = function (W) {
    return Math.max(2, Math.round((W || 100) / 45));   // 80→2, 100→2, 130→3
  };

  Packs.effect = function (id) { return EFFECTS[id] || null; };

  var P = Packs.prototype;

  P.reset = function () {
    this.lifeStart = 0; this.lifeCap = 0; this.heartCD = 0;
    this.packs.length = 0;
    this.nextId = 1;
    this.spawnCD = 40;         // הופעה ראשונה אחרי ~0.7 שנ'
    this.active = {};
    this.events.length = 0;
  };

  /* מצב חיים: start = מספר החיים ההתחלתי (0 = כבוי). התקרה: start+2 */
  P.setLives = function (start) {
    this.lifeStart = +start || 0;
    this.lifeCap = this.lifeStart ? this.lifeStart + 2 : 0;
    this.heartCD = HEART_FIRST;
  };
  P.regularCount = function () { var n = 0; for (var i = 0; i < this.packs.length; i++) if (this.packs[i].kind !== 'life') n++; return n; };
  P.heartCount = function () { return this.packs.length - this.regularCount(); };
  function canGain(p, cap) { return p.alive && !p.gone && (p.lives || 0) > 0 && (p.lives || 0) < cap; }
  P.anyoneBelowCap = function (g) { for (var i = 0; i < g.players.length; i++) if (canGain(g.players[i], this.lifeCap)) return true; return false; };
  P.spawnHeart = function (g, forced) {
    if (!this.lifeStart || this.heartCount() >= HEART_MAX) return null;
    var pos = forced || this.findPos(g);
    if (!pos) return null;
    var pack = { id: this.nextId++, x: g.wrap(pos.x), y: g.wrap(pos.y), effectId: 'life', kind: 'life' };
    this.packs.push(pack);
    this.events.push({ type: 'spawn', pack: { id: pack.id, x: pack.x, y: pack.y, kind: 'life' } });
    return pack;
  };

  P.clearPlayer = function (pid) {
    if (this.active[pid]) {
      this.events.push({ type: 'end', playerId: pid, effectId: this.active[pid].effectId });
      delete this.active[pid];
    }
  };

  P.speedMul = function (pid) {
    var a = this.active[pid];
    if (!a) return 1;
    var e = EFFECTS[a.effectId];
    return (e && e.speedMul) || 1;
  };

  P.activeOf = function (pid) { return this.active[pid] || null; };

  P.remaining = function (pid, tickNo, dt) {
    var a = this.active[pid];
    if (!a) return 0;
    if (a.untilMs) return Math.max(0, (a.untilMs - Date.now()) / 1000);
    return Math.max(0, (a.until - tickNo) * (dt || 1 / 60));
  };

  /* מיקום אקראי שלא על ראש; מותר על שטח חופשי או כבוש */
  P.findPos = function (g) {
    var W = g.W, best = null, bestScore = -1, attempt;
    for (attempt = 0; attempt < 48; attempt++) {
      var x = this.rand() * W, y = this.rand() * W, ok = true, minD = Infinity, k;
      for (k = 0; k < g.players.length; k++) {
        var q = g.players[k];
        if (!q.alive) continue;
        var d = Math.sqrt(g.dist2(x, y, q.x, q.y));
        if (d < HEAD_CLEAR) { ok = false; break; }
        if (d < minD) minD = d;
      }
      if (ok && g.pitSystem && g.pitSystem.dangerAt(g, x, y, 3)) ok = false;
      // גם לא על חבילה קיימת
      if (ok) for (k = 0; k < this.packs.length; k++) {
        var pk = this.packs[k];
        if (Math.sqrt(g.dist2(x, y, pk.x, pk.y)) < 3) { ok = false; break; }
      }
      if (!ok) continue;
      if (minD > bestScore) { bestScore = minD; best = { x: x, y: y }; if (minD > 12) break; }
    }
    return best;
  };

  P.spawnOne = function (g, forced) {
    if (this.regularCount() >= Packs.maxFor(g.W)) return null;
    var pos = forced || this.findPos(g);
    if (!pos) return null;
    var eid = EFFECT_IDS[Math.floor(this.rand() * EFFECT_IDS.length)];
    var pack = { id: this.nextId++, x: g.wrap(pos.x), y: g.wrap(pos.y), effectId: eid };
    this.packs.push(pack);
    this.events.push({ type: 'spawn', pack: { id: pack.id, x: pack.x, y: pack.y } }); // בלי effect – הפתעה
    return pack;
  };

  P.removePack = function (id) {
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id === id) { this.packs.splice(i, 1); return true; }
    return false;
  };

  P.apply = function (g, player, effectId, nowTick) {
    var e = EFFECTS[effectId];
    if (!e || !player) return null;
    this.clearPlayer(player.id);
    var until = nowTick + Math.round(e.duration / (g.DT || 1 / 60));
    this.active[player.id] = { effectId: e.id, until: until, untilMs: Date.now() + e.duration * 1000 };
    player.speedMul = e.speedMul || 1;
    return this.active[player.id];
  };

  P.pick = function (g, pack, player) {
    if (!pack || !player || !player.alive) return null;
    if (pack.kind === 'life') {
      if (!canGain(player, this.lifeCap)) return null;
      this.removePack(pack.id);
      player.lives++;
      this.heartCD = HEART_EVERY;
      this.events.push({ type: 'pick', packId: pack.id, playerId: player.id, effectId: 'life', lives: player.lives });
      return LIFE;
    }
    var eid = pack.effectId;
    this.removePack(pack.id);
    this.apply(g, player, eid, g.tickNo);
    this.events.push({ type: 'pick', packId: pack.id, playerId: player.id, effectId: eid });
    return EFFECTS[eid];
  };

  /* סימולציית מארח/סולו: תפוגה, איסוף, הופעה */
  P.tick = function (g) {
    this.events.length = 0;
    var pid, a, e, k, p, pack, best, bestD, d, hit2 = PICK_R * PICK_R;

    // תפוגה
    for (pid in this.active) {
      a = this.active[pid];
      if (g.tickNo >= a.until) {
        e = EFFECTS[a.effectId];
        var pl = g.players[pid - 1];
        if (pl) pl.speedMul = 1;
        this.events.push({ type: 'end', playerId: +pid, effectId: a.effectId });
        delete this.active[pid];
      }
    }
    // ניקוי למי שמת
    for (k = 0; k < g.players.length; k++) {
      p = g.players[k];
      if (!p.alive && this.active[p.id]) {
        p.speedMul = 1;
        this.events.push({ type: 'end', playerId: p.id, effectId: this.active[p.id].effectId });
        delete this.active[p.id];
      } else if (p.alive && this.active[p.id]) {
        p.speedMul = this.speedMul(p.id);
      } else if (p.alive) {
        p.speedMul = 1;
      }
    }

    // איסוף – הראש על החבילה
    for (k = 0; k < this.packs.length; ) {
      pack = this.packs[k];
      best = null; bestD = hit2;
      for (var j = 0; j < g.players.length; j++) {
        p = g.players[j];
        if (!p.alive) continue;
        if (pack.kind === 'life' && !canGain(p, this.lifeCap)) continue;   // בתקרה – הלב נשאר לאחרים
        d = g.dist2(p.x, p.y, pack.x, pack.y);
        if (d <= bestD) { bestD = d; best = p; }
      }
      if (best) this.pick(g, pack, best);   // מסיר מהמערך
      else k++;
    }

    // הופעה
    if (this.spawnCD > 0) this.spawnCD--;
    if (this.spawnCD <= 0 && this.regularCount() < Packs.maxFor(g.W)) {
      if (this.spawnOne(g)) this.spawnCD = SPAWN_EVERY;
      else this.spawnCD = 30;
    }
    // v9.13: לב – רק במצב חיים, ורק כשיש מישהו פעיל מתחת לתקרה
    if (this.lifeStart && this.heartCount() < HEART_MAX) {
      if (this.heartCD > 0) this.heartCD--;
      else if (!this.anyoneBelowCap(g)) this.heartCD = 60;
      else if (this.spawnHeart(g)) this.heartCD = HEART_EVERY;
      else this.heartCD = 30;
    }

    return this.events;
  };

  /* מצב לסנכרון (הצטרפות באמצע / לקוח) – בלי לחשוף את סוג האפקט */
  P.publicList = function () {
    return this.packs.map(function (p) { var o = { id: p.id, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }; if (p.kind === 'life') o.kind = 'life'; return o; });
  };

  P.applySync = function (list) {
    this.packs = (list || []).map(function (p) {
      return p.kind === 'life' ? { id: p.id, x: p.x, y: p.y, effectId: 'life', kind: 'life' } : { id: p.id, x: p.x, y: p.y, effectId: p.effectId || EFFECT_IDS[0] };
    });
    var max = 0;
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id > max) max = this.packs[i].id;
    this.nextId = max + 1;
  };

  /* לקוח: הופעה בלי סוג (סוג ייקבע באיסוף ע"י המארח) */
  P.clientSpawn = function (id, x, y, kind) {
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id === id) return;
    this.packs.push(kind === 'life' ? { id: id, x: x, y: y, effectId: 'life', kind: 'life' } : { id: id, x: x, y: y, effectId: '?' });
    if (id >= this.nextId) this.nextId = id + 1;
  };

  P.clientPick = function (g, packId, playerId, effectId) {
    this.removePack(packId);
    if (effectId === 'life') return LIFE;   // מספר החיים מגיע מהמארח בהודעת lives
    var p = g && g.players[playerId - 1];
    if (p) this.apply(g, p, effectId, g.tickNo || 0);
    return EFFECTS[effectId] || null;
  };

  P.clientEnd = function (g, playerId) {
    var p = g && g.players[playerId - 1];
    if (p) p.speedMul = 1;
    delete this.active[playerId];
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Packs;
  else root.Packs = Packs;
})(this);
