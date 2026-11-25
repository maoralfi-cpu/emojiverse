/* Emojiverse v9.21 – מצב מלכודת (סעיף 23): 🪤 מלכודת ו־💣 פצצה.
   קופסת הפתעה יכולה להכיל פריט (רק כשהמצב פעיל). הפריט נשמר בתא אחד (p.item) ומוטל בכפתור/רווח.
   סימולציה רק בסולו/מארח (Game.step קורא ל-tick); הלקוח מקבל מצב מלא בהודעת items ומצייר. */
(function (root) {
  'use strict';
  var TYPES = {
    trap: { id: 'trap', name: 'מלכודת', emoji: '🪤' },
    bomb: { id: 'bomb', name: 'פצצה', emoji: '💣' }
  };
  var IDS = ['trap', 'bomb'];
  function Items() { this.list = []; this.nextId = 1; this.events = []; this.booms = []; }
  Items.TYPES = TYPES;
  Items.IDS = IDS;
  Items.TRAP_R = 1.15;          // כמו רדיוס הבור
  Items.TRAP_TICKS = 30 * 60;   // 30 שנ' על המפה
  Items.FREEZE_TICKS = 2 * 60;  // קפיאה 2 שנ'
  Items.FUSE_TICKS = 3 * 60;    // פתיל 3 שנ'
  Items.BLAST_R = 3.5;          // רדיוס פיצוץ (יחידות עולם)
  Items.STACK_MAX = 9;          // v9.23: תקרת ערימת 🪤
  Items.isItem = function (id) { return id === 'trap' || id === 'bomb'; };
  Items.count = function (p) { return p && Items.isItem(p.item) ? Math.max(1, Math.min(Items.STACK_MAX, p.itemN || 1)) : 0; };
  Items.clear = function (p) { if (p) { p.item = null; p.itemN = 0; } };
  Items.type = function (id) { return TYPES[id] || null; };
  Items.norm = function (v) { return v === 'on' || v === true ? 'on' : 'off'; };
  Items.frozen = function (p, tickNo) { return !!(p && p.frozenUntil && tickNo < p.frozenUntil); };
  var P = Items.prototype;

  P.reset = function () { this.list.length = 0; this.nextId = 1; this.events.length = 0; this.booms.length = 0; };

  /* הטלה: במיקום הנוכחי של הראש. מחזיר את הפריט או null */
  P.drop = function (g, p) {
    if (!g || !p || !p.alive || !Items.isItem(p.item)) return null;
    var k = p.item, it = { id: this.nextId++, k: k, x: g.wrap(p.x), y: g.wrap(p.y), o: p.id, until: g.tickNo + (k === 'trap' ? Items.TRAP_TICKS : Items.FUSE_TICKS) };
    if (k === 'trap' && (p.itemN || 1) > 1) p.itemN--;
    else { p.item = null; p.itemN = 0; }
    this.list.push(it);
    this.events.push({ type: 'drop', item: it, playerId: p.id });
    return it;
  };
  P.remove = function (id) { for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) { this.list.splice(i, 1); return true; } return false; };

  /* מרחק (בריבוע) ממקטע התנועה של p אל נקודה – כמו בבורות (דרך התפר) */
  function segHit2(g, p, x, y) {
    var ax = p.px, ay = p.py, dx = (p.ux != null ? p.ux : p.x) - ax, dy = (p.uy != null ? p.uy : p.y) - ay, len2 = dx * dx + dy * dy;
    var hx = g.wd(x - ax), hy = g.wd(y - ay);
    var t = len2 ? Math.max(0, Math.min(1, (hx * dx + hy * dy) / len2)) : 0;
    var ex = hx - t * dx, ey = hy - t * dy;
    return ex * ex + ey * ey;
  }

  /* צעד מארח/סולו – נקרא מתוך Game.step אחרי התנועה והבורות, לפני שאר ההתנגשויות */
  P.tick = function (g) {
    var ps = g.players, i, k, p, it, r2 = Items.TRAP_R * Items.TRAP_R;
    for (k = 0; k < ps.length; k++) { p = ps[k]; if (!p.alive) { p.item = null; p.itemN = 0; p.frozenUntil = 0; } }
    for (i = 0; i < this.list.length; ) {
      it = this.list[i];
      if (it.k === 'trap') {
        var hit = null;
        for (k = 0; k < ps.length && !hit; k++) {
          p = ps[k];
          if (!p.alive || p.id === it.o || Items.frozen(p, g.tickNo)) continue;   // הבעלים חסין
          if (segHit2(g, p, it.x, it.y) <= r2) hit = p;
        }
        if (hit) {
          hit.frozenUntil = g.tickNo + Items.FREEZE_TICKS;
          this.list.splice(i, 1);
          this.events.push({ type: 'snap', playerId: hit.id, ownerId: it.o, x: it.x, y: it.y });
          continue;
        }
        if (g.tickNo >= it.until) { this.list.splice(i, 1); this.events.push({ type: 'expire', item: it }); continue; }
      } else if (g.tickNo >= it.until) {
        this.list.splice(i, 1);
        this.explode(g, it);
        continue;
      }
      i++;
    }
  };

  /* פיצוץ: ראש ברדיוס = נפסל (גם המטיל). שטח של יריבים ברדיוס הופך לניטרלי; השטח של המטיל לא נפגע */
  P.explode = function (g, it) {
    var R = Items.BLAST_R, R2 = R * R, ps = g.players, owner = ps[it.o - 1] || null, victims = [], k, p;
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (p.alive && g.dist2(p.x, p.y, it.x, it.y) <= R2) victims.push(p);
    }
    for (k = 0; k < victims.length; k++) g.kill(victims[k], victims[k] === owner ? null : owner, 'bomb');
    var C = g.CELL, G = g.G, hit = {}, cleared = 0;
    var x0 = Math.floor((it.x - R) / C), x1 = Math.floor((it.x + R) / C), y0 = Math.floor((it.y - R) / C), y1 = Math.floor((it.y + R) / C);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var dx = (cx + 0.5) * C - it.x, dy = (cy + 0.5) * C - it.y;
      if (dx * dx + dy * dy > R2) continue;
      var ci = ((cy % G) + G) % G * G + ((cx % G) + G) % G, o = g.owner[ci];
      if (!o || o === it.o) continue;
      g.setOwner(ci, 0); hit[o] = 1; cleared++;
    }
    for (var id in hit) {
      g._lost[id] = 1;   // איים שנוצרו מהחור – לפי כלל האיים הקיים
      p = ps[id - 1];
      if (p && p.alive && g.counts[p.id] <= 0) g.kill(p, owner && owner !== p ? owner : null, 'bomb');
    }
    if (cleared) g.pruneIslands();
    this.events.push({ type: 'boom', x: it.x, y: it.y, ownerId: it.o, victims: victims.map(function (v) { return v.id; }), cells: cleared });
  };

  /* בוטים: סכנה בנקודה – מלכודת של אחר או פצצה חיה (כולל שלי) */
  P.dangerAt = function (g, p, x, y, margin) {
    for (var i = 0; i < this.list.length; i++) {
      var it = this.list[i], r;
      if (it.k === 'trap') { if (it.o === p.id) continue; r = Items.TRAP_R + (margin || 0); }
      else r = Items.BLAST_R + 1;
      if (g.dist2(x, y, it.x, it.y) <= r * r) return true;
    }
    return false;
  };
  /* בוטים: כיוון בריחה מפצצה חיה קרובה (או null) */
  P.fleeAngle = function (g, p) {
    var best = null, bd = Infinity, R = Items.BLAST_R + 2.5;
    for (var i = 0; i < this.list.length; i++) {
      var it = this.list[i]; if (it.k !== 'bomb') continue;
      var d2 = g.dist2(p.x, p.y, it.x, it.y);
      if (d2 < R * R && d2 < bd) { bd = d2; best = it; }
    }
    if (!best) return null;
    return Math.atan2(-g.wd(best.y - p.y), -g.wd(best.x - p.x));
  };

  /* סנכרון מארח→לקוח: מצב מלא (רשימה, פריט ביד, קפואים). key – כדי לשלוח רק כשמשהו השתנה */
  P.netState = function (g) {
    var held = [], frz = [], t = g.tickNo;
    for (var k = 0; k < g.players.length; k++) {
      var p = g.players[k];
      held.push(p.item === 'trap' ? Items.count(p) : p.item === 'bomb' ? 10 : 0);
      frz.push(Items.frozen(p, t) ? p.frozenUntil - t : 0);
    }
    var list = this.list.map(function (it) { return { id: it.id, k: it.k === 'bomb' ? 2 : 1, x: Math.round(it.x * 100) / 100, y: Math.round(it.y * 100) / 100, o: it.o, l: Math.max(0, it.until - t) }; });
    var key = list.map(function (it) { return it.id; }).join(',') + '|' + held.join(',') + '|' + frz.map(function (f) { return f ? 1 : 0; }).join('');
    return { key: key, msg: { t: 'items', list: list, held: held, frz: frz } };
  };
  /* לקוח: מחיל מצב מהמארח. זמנים לפי השעון המקומי (ms) */
  P.applyNet = function (g, m, nowMs, tickMs) {
    if (!g || !m) return;
    tickMs = tickMs || 1000 / 60;
    this.list = (m.list || []).filter(function (it) { return it && isFinite(it.x) && isFinite(it.y); }).map(function (it) {
      return { id: it.id, k: it.k === 2 ? 'bomb' : 'trap', x: g.wrap(it.x), y: g.wrap(it.y), o: it.o, atMs: nowMs + (it.l || 0) * tickMs };
    });
    for (var k = 0; k < g.players.length; k++) {
      var p = g.players[k], h = (m.held || [])[k], f = (m.frz || [])[k];
      if (h >= 1 && h <= 9) { p.item = 'trap'; p.itemN = h; }
      else if (h === 10) { p.item = 'bomb'; p.itemN = 1; }
      else { p.item = null; p.itemN = 0; }
      p.frozenMs = f ? nowMs + f * tickMs : 0;
    }
  };
  /* שניות שנותרו לפתיל (סולו/מארח לפי צעדים, לקוח לפי שעון) */
  Items.left = function (it, tickNo, nowMs, dt) {
    if (it.atMs) return Math.max(0, (it.atMs - nowMs) / 1000);
    return Math.max(0, (it.until - tickNo) * (dt || 1 / 60));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Items;
  else root.Items = Items;
})(this);
