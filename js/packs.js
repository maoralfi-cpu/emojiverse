/* Emojiverse – חבילות הפתעה (v9.5). טבלאת אפקטים + לוגיקת הופעה/איסוף/תפוגה (נבדק ב-node).
   חבילה מוצגת כ-🎁 עד האיסוף. במצב מהיר (v9.22) היא נראית כמשטח על הקרקע לפי הסוג.
   המארח מחליט על הופעה ואיסוף; אפקטים חזותיים מקומיים לאוסף. */
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
    wide:   { id: 'wide',   name: 'שדה ראייה רחב',  emoji: '🔭', good: true,  duration: DURATION, visual: 'wide' },
    /* v9.19: ארבע הפתעות חדשות (סעיף 21) */
    ice:    { id: 'ice',    name: 'קרח',            emoji: '🧊', good: false, duration: 6, ice: true },
    ghost:  { id: 'ghost',  name: 'שובל נעלם',      emoji: '👻', good: false, duration: 6, visual: 'ghost' },
    dark:   { id: 'dark',   name: 'החשכה',          emoji: '🔦', good: false, duration: 7, visual: 'dark' },
    radar:  { id: 'radar',  name: 'רדאר',           emoji: '📡', good: false, duration: 7, visual: 'radar' }
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
    this.items = false;        // v9.21 מצב מלכודת: 🪤/💣 בתוך הקופסאות
    this.reveal = false;       // v9.22: במצב מהיר הסוג גלוי (משטח) ומשודר לאורח
  }

  /* v9.21: פריטי מצב מלכודת – נכנסים למאגר רק כשהמצב פעיל; לא מפעילים כלום באיסוף, רק נשמרים בתא */
  var ITEM_IDS = ['trap', 'bomb'];
  var ITEMS = { trap: { id: 'trap', name: 'מלכודת', emoji: '🪤', item: true }, bomb: { id: 'bomb', name: 'פצצה', emoji: '💣', item: true } };
  Packs.ITEM_IDS = ITEM_IDS;
  Packs.isItem = function (id) { return id === 'trap' || id === 'bomb'; };

  Packs.EFFECTS = EFFECTS;
  Packs.EFFECT_IDS = EFFECT_IDS;
  Packs.ICON = ICON;
  Packs.DURATION = DURATION;
  Packs.PICK_R = PICK_R;
  Packs.LIFE = LIFE;
  Packs.HEART_ICON = LIFE.emoji;
  Packs.HEART_EVERY = HEART_EVERY;

  /* v9.22: משטח גלוי במצב מהיר. סוג בלי מראה ברור נשאר 🎁. */
  Packs.LOOKS = {
    speed: 'boost', slow: 'mud', invert: 'vortex', wide: 'beacon',
    life: 'heart', ice: 'ice', ghost: 'mist', dark: 'lantern',
    radar: 'radar', trap: 'snare', bomb: 'mine'
  };
  Packs.lookOf = function (pack) {
    if (!pack) return 'gift';
    if (pack.kind === 'life' || pack.effectId === 'life') return 'heart';
    return Packs.LOOKS[pack.effectId] || 'gift';
  };
  Packs.revealForSpeed = function (s) { return s === 'fast'; };

  Packs.maxFor = function (W) {
    return Math.max(2, Math.round((W || 100) / 45));   // 80→2, 100→2, 130→3
  };

  Packs.effect = function (id) { return EFFECTS[id] || ITEMS[id] || null; };

  var P = Packs.prototype;

  P.reset = function () {
    this.lifeStart = 0; this.lifeCap = 0; this.heartCD = 0; this.items = false; this.reveal = false;
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
  P.setItems = function (on) { this.items = !!on; };
  P.setReveal = function (on) { this.reveal = !!on; };
  /* רשימה/אירוע רשת: במצב רגיל בלי סוג (הפתעה); במצב מהיר עם effectId כדי שהאורח יצייר אותו משטח */
  P.packPublic = function (pack) {
    var o = { id: pack.id, x: Math.round(pack.x * 100) / 100, y: Math.round(pack.y * 100) / 100 };
    if (pack.kind === 'life') o.kind = 'life';
    else if (this.reveal && pack.effectId && pack.effectId !== '?') o.effectId = pack.effectId;
    return o;
  };
  /* המאגר: 8 ההפתעות, ובמצב מלכודת גם 🪤 ו־💣 – כולם באותו סיכוי */
  P.pool = function () { return this.items ? EFFECT_IDS.concat(ITEM_IDS) : EFFECT_IDS; };
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
    this.events.push({ type: 'spawn', pack: this.packPublic(pack) });
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
    var pool = this.pool(), eid = pool[Math.floor(this.rand() * pool.length)];
    var pack = { id: this.nextId++, x: g.wrap(pos.x), y: g.wrap(pos.y), effectId: eid };
    this.packs.push(pack);
    this.events.push({ type: 'spawn', pack: this.packPublic(pack) }); // בלי effect במצב רגיל – הפתעה
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
    player.ice = !!e.ice; player.mh = player.h;
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
    if (ITEMS[eid]) {   // v9.21: פריט נכנס לתא היחיד (מחליף את הקודם), בלי להשפיע על אפקט פעיל
      player.item = eid;
      this.events.push({ type: 'pick', packId: pack.id, playerId: player.id, effectId: eid });
      return ITEMS[eid];
    }
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
        if (pl) { pl.speedMul = 1; pl.ice = false; }
        this.events.push({ type: 'end', playerId: +pid, effectId: a.effectId });
        delete this.active[pid];
      }
    }
    // ניקוי למי שמת
    for (k = 0; k < g.players.length; k++) {
      p = g.players[k];
      if (!p.alive && this.active[p.id]) {
        p.speedMul = 1; p.ice = false;
        this.events.push({ type: 'end', playerId: p.id, effectId: this.active[p.id].effectId });
        delete this.active[p.id];
      } else if (p.alive && this.active[p.id]) {
        p.speedMul = this.speedMul(p.id);
        var ae = EFFECTS[this.active[p.id].effectId]; p.ice = !!(ae && ae.ice);
      } else if (p.alive) {
        p.speedMul = 1; p.ice = false;
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
    var self = this;
    return this.packs.map(function (p) { return self.packPublic(p); });
  };

  P.applySync = function (list) {
    this.packs = (list || []).map(function (p) {
      return p.kind === 'life' ? { id: p.id, x: p.x, y: p.y, effectId: 'life', kind: 'life' } : { id: p.id, x: p.x, y: p.y, effectId: p.effectId || p.e || '?' };
    });
    var max = 0;
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id > max) max = this.packs[i].id;
    this.nextId = max + 1;
  };

  /* לקוח: הופעה בלי סוג (סוג ייקבע באיסוף ע"י המארח) */
  P.clientSpawn = function (id, x, y, kind, effectId) {
    for (var i = 0; i < this.packs.length; i++) if (this.packs[i].id === id) return;
    this.packs.push(kind === 'life' ? { id: id, x: x, y: y, effectId: 'life', kind: 'life' } : { id: id, x: x, y: y, effectId: effectId || '?' });
    if (id >= this.nextId) this.nextId = id + 1;
  };

  P.clientPick = function (g, packId, playerId, effectId) {
    this.removePack(packId);
    if (effectId === 'life') return LIFE;   // מספר החיים מגיע מהמארח בהודעת lives
    var p = g && g.players[playerId - 1];
    if (ITEMS[effectId]) { if (p) p.item = effectId; return ITEMS[effectId]; }
    if (p) this.apply(g, p, effectId, g.tickNo || 0);
    return EFFECTS[effectId] || null;
  };

  P.clientEnd = function (g, playerId) {
    var p = g && g.players[playerId - 1];
    if (p) { p.speedMul = 1; p.ice = false; }
    delete this.active[playerId];
  };


  /* v9.22: ציור משטח/🎁. זול (בלי shadowBlur, בלי הקצאות), אנימציה רכה בלי הבהוב. reduced = סטטי. */
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function oval(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  Packs.draw = function (ctx, x, y, unitPx, now, pack, opts) {
    opts = opts || {};
    var look = Packs.lookOf(pack);
    if (!opts.reveal && look !== 'heart') look = 'gift';
    var t = opts.reduced ? 0 : (now || 0) / 1000;
    var R = unitPx * 1.55;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (look === 'gift' || look === 'heart') {
      var pulse = opts.reduced ? 1 : 1 + 0.08 * Math.sin((now || 0) / 220);
      ctx.font = Math.round(unitPx * 1.55 * pulse) + 'px ' + EMOJI_FONT;
      ctx.fillText(look === 'heart' ? Packs.HEART_ICON : Packs.ICON, 0, 0);
    } else {
      (DRAW[look] || DRAW.gift)(ctx, R, t);
    }
    ctx.restore();
  };
  var DRAW = {
    boost: function (c, R, t) {
      var slide = ((t * 0.35) % 1) * R * 0.9;
      c.rotate(-0.4);
      oval(c, 0, 0, R * 1.35, R * 0.52);
      c.fillStyle = 'rgba(230, 175, 55, 0.62)'; c.fill();
      c.strokeStyle = 'rgba(190, 130, 20, 0.85)'; c.lineWidth = Math.max(1.2, R * 0.07); c.stroke();
      c.strokeStyle = 'rgba(255, 245, 210, 0.9)'; c.lineWidth = Math.max(1.5, R * 0.1);
      var i, x;
      for (i = -1; i <= 1; i++) {
        x = i * R * 0.9 - slide;
        c.beginPath();
        c.moveTo(x - R * 0.22, -R * 0.28);
        c.lineTo(x + R * 0.18, 0);
        c.lineTo(x - R * 0.22, R * 0.28);
        c.stroke();
      }
    },
    mud: function (c, R, t) {
      var w = 1 + 0.04 * Math.sin(t * 1.1);
      oval(c, 0, 0, R * 1.15 * w, R * 0.78);
      c.fillStyle = 'rgba(96, 68, 32, 0.78)'; c.fill();
      oval(c, -R * 0.38, R * 0.12, R * 0.62, R * 0.48);
      c.fillStyle = 'rgba(74, 52, 24, 0.7)'; c.fill();
      oval(c, R * 0.42, -R * 0.08, R * 0.55, R * 0.4);
      c.fillStyle = 'rgba(122, 86, 40, 0.55)'; c.fill();
      oval(c, -R * 0.1, -R * 0.18, R * 0.35, R * 0.2);
      c.fillStyle = 'rgba(150, 110, 60, 0.28)'; c.fill();
    },
    vortex: function (c, R, t) {
      c.rotate(t * 0.7);
      oval(c, 0, 0, R * 1.05, R * 1.05);
      c.fillStyle = 'rgba(90, 80, 160, 0.28)'; c.fill();
      var i;
      for (i = 0; i < 3; i++) {
        c.strokeStyle = 'rgba(80, 70, 170, ' + (0.55 - i * 0.12) + ')';
        c.lineWidth = Math.max(1.4, R * (0.14 - i * 0.02));
        c.beginPath();
        c.arc(0, 0, R * (0.85 - i * 0.22), i * 0.9, i * 0.9 + 4.2);
        c.stroke();
      }
    },
    beacon: function (c, R, t) {
      var a = 0.22 + 0.06 * Math.sin(t * 1.2);
      oval(c, 0, R * 0.15, R * 1.15, R * 0.55);
      c.fillStyle = 'rgba(40, 48, 64, 0.35)'; c.fill();
      c.save();
      c.rotate(t * 0.55);
      c.fillStyle = 'rgba(255, 220, 120, ' + a + ')';
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, R * 1.25, -0.55, 0.55);
      c.closePath();
      c.fill();
      c.restore();
      c.fillStyle = 'rgba(70, 78, 92, 0.95)';
      c.fillRect(-R * 0.16, -R * 0.55, R * 0.32, R * 0.85);
      oval(c, 0, -R * 0.58, R * 0.22, R * 0.18);
      c.fillStyle = 'rgba(255, 230, 140, 0.9)'; c.fill();
    },
    ice: function (c, R, t) {
      var a = 0.28 + 0.07 * Math.sin(t * 1.15);
      oval(c, 0, 0, R * 1.15, R * 0.82);
      c.fillStyle = 'rgba(170, 220, 235, 0.72)'; c.fill();
      c.strokeStyle = 'rgba(230, 250, 255, 0.85)'; c.lineWidth = Math.max(1.2, R * 0.07); c.stroke();
      oval(c, -R * 0.25, -R * 0.15, R * 0.4, R * 0.22);
      c.fillStyle = 'rgba(255, 255, 255, ' + a + ')'; c.fill();
      c.strokeStyle = 'rgba(120, 180, 200, 0.55)'; c.lineWidth = Math.max(1, R * 0.045);
      c.beginPath();
      c.moveTo(-R * 0.55, -R * 0.1); c.lineTo(-R * 0.1, R * 0.25); c.lineTo(R * 0.35, -R * 0.05);
      c.moveTo(R * 0.05, -R * 0.35); c.lineTo(R * 0.2, R * 0.15);
      c.stroke();
    },
    mist: function (c, R, t) {
      var a = 0.5 + 0.08 * Math.sin(t * 0.9);
      oval(c, 0, 0, R * 1.12, R * 0.82);
      c.fillStyle = 'rgba(168, 180, 210, ' + a + ')'; c.fill();
      c.strokeStyle = 'rgba(120, 132, 170, 0.5)'; c.lineWidth = Math.max(1.1, R * 0.06); c.stroke();
      oval(c, -R * 0.2, -R * 0.08, R * 0.7, R * 0.48);
      c.fillStyle = 'rgba(220, 226, 240, ' + (0.35 + 0.08 * Math.sin(t * 0.9 + 1)) + ')'; c.fill();
      oval(c, R * 0.38, R * 0.1, R * 0.58, R * 0.4);
      c.fillStyle = 'rgba(200, 208, 230, 0.4)'; c.fill();
    },
    lantern: function (c, R, t) {
      var a = 0.2 + 0.06 * Math.sin(t * 0.8);
      oval(c, 0, 0, R * 1.1, R * 0.85);
      c.fillStyle = 'rgba(28, 28, 36, 0.55)'; c.fill();
      oval(c, 0, 0, R * 0.45, R * 0.35);
      c.fillStyle = 'rgba(255, 190, 90, ' + a + ')'; c.fill();
      oval(c, 0, 0, R * 0.18, R * 0.14);
      c.fillStyle = 'rgba(255, 230, 160, 0.55)'; c.fill();
    },
    radar: function (c, R, t) {
      var ph = (t * 0.35) % 1;
      oval(c, 0, 0, R * 0.95, R * 0.95);
      c.fillStyle = 'rgba(50, 130, 120, 0.22)'; c.fill();
      c.strokeStyle = 'rgba(40, 120, 115, 0.55)'; c.lineWidth = Math.max(1.1, R * 0.06);
      oval(c, 0, 0, R * 0.95, R * 0.95); c.stroke();
      oval(c, 0, 0, R * 0.55, R * 0.55); c.stroke();
      c.strokeStyle = 'rgba(40, 120, 115, ' + (0.5 * (1 - ph)) + ')';
      oval(c, 0, 0, R * (0.25 + ph * 0.85), R * (0.25 + ph * 0.85)); c.stroke();
      c.save();
      c.rotate(t * 0.9);
      c.strokeStyle = 'rgba(70, 170, 150, 0.45)'; c.lineWidth = Math.max(1.2, R * 0.07);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(R * 0.95, 0); c.stroke();
      c.restore();
    },
    snare: function (c, R) {
      oval(c, 0, 0, R * 1.05, R * 0.72);
      c.fillStyle = 'rgba(130, 92, 50, 0.72)'; c.fill();
      c.strokeStyle = 'rgba(70, 48, 24, 0.85)'; c.lineWidth = Math.max(1.4, R * 0.08); c.stroke();
      c.beginPath();
      c.moveTo(-R * 0.7, -R * 0.2); c.lineTo(R * 0.7, R * 0.2);
      c.moveTo(-R * 0.7, R * 0.2); c.lineTo(R * 0.7, -R * 0.2);
      c.stroke();
      oval(c, 0, 0, R * 0.28, R * 0.2);
      c.fillStyle = 'rgba(60, 40, 20, 0.55)'; c.fill();
    },
    mine: function (c, R) {
      oval(c, 0, 0, R * 0.95, R * 0.7);
      c.fillStyle = 'rgba(55, 55, 62, 0.82)'; c.fill();
      c.strokeStyle = 'rgba(160, 90, 70, 0.7)'; c.lineWidth = Math.max(1.3, R * 0.08); c.stroke();
      oval(c, 0, 0, R * 0.42, R * 0.3);
      c.fillStyle = 'rgba(80, 80, 88, 0.95)'; c.fill();
      oval(c, -R * 0.12, -R * 0.1, R * 0.16, R * 0.1);
      c.fillStyle = 'rgba(200, 200, 210, 0.35)'; c.fill();
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Packs;
  else root.Packs = Packs;
})(this);
