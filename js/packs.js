/* Emojiverse – חבילות הפתעה (v9.5). טבלאת אפקטים + לוגיקת הופעה/איסוף/תפוגה (נבדק ב-node).
   חבילה מוצגת כ-🎁 עד האיסוף. המארח מחליט על הופעה ואיסוף; אפקטים חזותיים מקומיים לאוסף. */
(function (root) {
  'use strict';

  var DURATION = 7;          // שניות (6–8)
  var PICK_R = 1.15;         // רדיוס איסוף (יחידות)
  var HEAD_CLEAR = 4;        // לא על ראש שחקן
  var SPAWN_EVERY = 150;     // ~2.5 שנ' בין ניסיונות הופעה כשיש מקום
  var ICON = '🎁';

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
  }

  Packs.EFFECTS = EFFECTS;
  Packs.EFFECT_IDS = EFFECT_IDS;
  Packs.ICON = ICON;
  Packs.DURATION = DURATION;
  Packs.PICK_R = PICK_R;

  Packs.maxFor = function (W) {
    return Math.max(2, Math.round((W || 100) / 45));   // 80→2, 100→2, 130→3
  };

  Packs.effect = function (id) { return EFFECTS[id] || null; };

  var P = Packs.prototype;

  P.reset = function () {
    this.packs.length = 0;
    this.nextId = 1;
    this.spawnCD = 40;         // הופעה ראשונה אחרי ~0.7 שנ'
    this.active = {};
    this.events.length = 0;
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
    if (this.packs.length >= Packs.maxFor(g.W)) return null;
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
        d = g.dist2(p.x, p.y, pack.x, pack.y);
        if (d <= bestD) { bestD = d; best = p; }
      }
      if (best) this.pick(g, pack, best);   // מסיר מהמערך
      else k++;
    }

    // הופעה
    if (this.spawnCD > 0) this.spawnCD--;
    if (this.spawnCD <= 0 && this.packs.length < Packs.maxFor(g.W)) {
      if (this.spawnOne(g)) this.spawnCD = SPAWN_EVERY;
      else this.spawnCD = 30;
    }

    return this.events;
  };

  /* מצב לסנכרון (הצטרפות באמצע / לקוח) – בלי לחשוף את סוג האפקט */
  P.publicList = function () {
    return this.packs.map(function (p) { return { id: p.id, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }; });
  };

  P.applySync = function (list) {
    this.packs = (list || []).map(function (p) {
      return { id: p.id, x: p.x, y: p.y, effectId: p.effectId || EFFECT_IDS[0] };
    });
    var max = 0;
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id > max) max = this.packs[i].id;
    this.nextId = max + 1;
  };

  /* לקוח: הופעה בלי סוג (סוג ייקבע באיסוף ע"י המארח) */
  P.clientSpawn = function (id, x, y) {
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id === id) return;
    this.packs.push({ id: id, x: x, y: y, effectId: '?' });
    if (id >= this.nextId) this.nextId = id + 1;
  };

  P.clientPick = function (g, packId, playerId, effectId) {
    this.removePack(packId);
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
