/* Emojiverse v9.21 – מצב מלכודת (סעיף 23): 🪤 מלכודת ו־💣 פצצה.
   קופסת הפתעה יכולה להכיל פריט (רק כשהמצב פעיל). v9.28/v9.29: שני תאים נפרדים – p.traps (0–9) ו-p.bomb (0–9) – ושני כפתורים.
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
  /* v9.26: רדיוס פגיעה וציור של מלכודת שהונחה = גודל ציור מלכודת האיסוף
     (Packs.draw: R=1.6, oval אופקי R*1.12). פעם היה 1.15 כמו הבור. */
  Items.TRAP_R = 1.6 * 1.12;
  Items.TRAP_TICKS = 30 * 60;   // 30 שנ' על המפה
  Items.GRACE_TICKS = 36;       // v9.24: חסד ~0.6 שנ' למטיל אחרי ההטלה
  Items.FREEZE_TICKS = 2 * 60;  // נשאר לתאימות רשת/בדיקות; מלכודת כבר לא מקפיאה
  Items.FUSE_TICKS = 3 * 60;    // פתיל 3 שנ'
  Items.BLAST_R_OLD = 3.5;      // רדיוס עד v9.25
  Items.BLAST_R = 3.5 * 2.5;    // v9.26: פי 2.5 (8.75 יח׳ = 17.5 תאים, CELL=0.5)
  Items.STACK_MAX = 9;          // תקרת ערימת 🪤 ו-💣
  Items.isItem = function (id) { return id === 'trap' || id === 'bomb'; };
  /* v9.28/v9.29: מלכודות ופצצות נשמרות יחד ונערמות עד 9. adopt קורא גם כתיבה ישנה ל-item/itemN. */
  Items.adopt = function (p) {
    if (!p) return p;
    if (p.traps == null) p.traps = 0;
    if (p.bomb == null) p.bomb = 0;
    if (!p.traps && !p.bomb) {
      if (p.item === 'trap') p.traps = Math.max(1, Math.min(Items.STACK_MAX, p.itemN || 1));
      else if (p.item === 'bomb') p.bomb = Math.max(1, Math.min(Items.STACK_MAX, p.itemN || 1));
    } else if (!p.traps && p.item === 'trap' && (p.itemN || 0) > 0) {
      p.traps = Math.min(Items.STACK_MAX, p.itemN);
    } else if (!p.bomb && p.item === 'bomb' && (p.itemN || 0) > 0) {
      p.bomb = Math.min(Items.STACK_MAX, p.itemN || 1);
    }
    return p;
  };
  Items.sync = function (p) {
    if (!p) return p;
    p.traps = Math.max(0, Math.min(Items.STACK_MAX, p.traps | 0));
    p.bomb = Math.max(0, Math.min(Items.STACK_MAX, p.bomb | 0));
    if (p.traps > 0) { p.item = 'trap'; p.itemN = p.traps; }
    else if (p.bomb) { p.item = 'bomb'; p.itemN = p.bomb; }
    else { p.item = null; p.itemN = 0; }
    return p;
  };
  Items.traps = function (p) { return p ? Items.sync(p).traps : 0; };
  Items.bombs = function (p) { return p ? Items.sync(p).bomb : 0; };
  Items.hasBomb = function (p) { return Items.bombs(p) > 0; };
  Items.count = function (p) { return Items.traps(p); };
  Items.give = function (p, kind) {
    if (!p) return false;
    Items.adopt(p);
    if (kind === 'trap') {
      if (p.traps >= Items.STACK_MAX) return false;
      p.traps++; Items.sync(p); return true;
    }
    if (kind === 'bomb') {
      if (p.bomb >= Items.STACK_MAX) return false;
      p.bomb++; Items.sync(p); return true;
    }
    return false;
  };
  Items.clear = function (p) { if (p) { p.traps = 0; p.bomb = 0; p.item = null; p.itemN = 0; } };
  Items.type = function (id) { return TYPES[id] || null; };
  Items.norm = function (v) { return v === 'on' || v === true ? 'on' : 'off'; };
  Items.frozen = function (p, tickNo) { return !!(p && p.frozenUntil && tickNo < p.frozenUntil); };
  var P = Items.prototype;

  P.reset = function () { this.list.length = 0; this.nextId = 1; this.events.length = 0; this.booms.length = 0; };

  /* הטלה: במיקום הנוכחי של הראש. מחזיר את הפריט או null */
  P.drop = function (g, p, kind) {
    if (!g || !p || !p.alive) return null;
    Items.adopt(p);
    var k = kind === 'bomb' || kind === 'trap' ? kind : (p.traps ? 'trap' : p.bomb ? 'bomb' : null);
    if (k === 'trap' && !p.traps) return null;
    if (k === 'bomb' && !p.bomb) return null;
    if (!k) return null;
    var it = { id: this.nextId++, k: k, x: g.wrap(p.x), y: g.wrap(p.y), o: p.id, until: g.tickNo + (k === 'trap' ? Items.TRAP_TICKS : Items.FUSE_TICKS) };
    if (k === 'trap') it.arm = g.tickNo + Items.GRACE_TICKS;
    if (k === 'trap') p.traps--;
    else p.bomb--;
    Items.sync(p);
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
    for (k = 0; k < ps.length; k++) { p = ps[k]; if (!p.alive) { Items.clear(p); p.frozenUntil = 0; } }
    for (i = 0; i < this.list.length; ) {
      it = this.list[i];
      if (it.k === 'trap') {
        var hit = null, armed = g.tickNo >= (it.arm || 0);
        for (k = 0; k < ps.length && !hit; k++) {
          p = ps[k];
          if (!p.alive) continue;
          if (p.invulnUntil && g.tickNo < p.invulnUntil) continue;
          if (!armed && p.id === it.o) continue;   // חסד קצר רק למטיל
          if (segHit2(g, p, it.x, it.y) <= r2) hit = p;
        }
        if (hit) {
          var owner = ps[it.o - 1] || null;
          this.list.splice(i, 1);
          this.events.push({ type: 'trip', playerId: hit.id, ownerId: it.o, x: it.x, y: it.y });
          g.kill(hit, hit.id === it.o ? null : owner, 'trap');
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

  /* פיצוץ v9.26: ראש או שובל פתוח ברדיוס = נפסל (גם המטיל, דרך g.kill כמו כל פסילה). שטח של יריבים ברדיוס ניטרלי; שטח המטיל לא נפגע */
  P.explode = function (g, it) {
    var R = Items.BLAST_R, R2 = R * R, ps = g.players, owner = ps[it.o - 1] || null, victims = [], k, p;
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.alive) continue;
      if (p.invulnUntil && g.tickNo < p.invulnUntil) continue;
      if (g.dist2(p.x, p.y, it.x, it.y) <= R2) { victims.push(p); continue; }
      if (p.trail && p.trail.length && g.trailDist2(p, it.x, it.y, 0, true) <= R2) victims.push(p);
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

  /* בוטים: סכנה בנקודה – כל מלכודת שהונחה (כולל שלי) או פצצה חיה */
  P.dangerAt = function (g, p, x, y, margin) {
    for (var i = 0; i < this.list.length; i++) {
      var it = this.list[i], r, d2, here;
      if (it.k === 'trap') r = Items.TRAP_R + (margin || 0);
      else r = Items.BLAST_R + 1;
      d2 = g.dist2(x, y, it.x, it.y);
      if (d2 > r * r) continue;
      if (it.k === 'trap') {   // כבר עומדים עליה: לא חוסמים כיוון בריחה, רק התקרבות
        here = g.dist2(p.x, p.y, it.x, it.y);
        if (here <= r * r && d2 >= here - 1e-9) continue;
      }
      return true;
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
    var held = [], bombs = [], frz = [], t = g.tickNo;
    for (var k = 0; k < g.players.length; k++) {
      var p = g.players[k];
      Items.adopt(p);
      held.push(Items.traps(p));
      bombs.push(Items.bombs(p));
      frz.push(Items.frozen(p, t) ? p.frozenUntil - t : 0);
    }
    var list = this.list.map(function (it) { return { id: it.id, k: it.k === 'bomb' ? 2 : 1, x: Math.round(it.x * 100) / 100, y: Math.round(it.y * 100) / 100, o: it.o, l: Math.max(0, it.until - t) }; });
    var key = list.map(function (it) { return it.id; }).join(',') + '|' + held.join(',') + '|' + bombs.join(',') + '|' + frz.map(function (f) { return f ? 1 : 0; }).join('');
    return { key: key, msg: { t: 'items', list: list, held: held, bombs: bombs, frz: frz } };
  };
  /* לקוח: מחיל מצב מהמארח. זמנים לפי השעון המקומי (ms) */
  P.applyNet = function (g, m, nowMs, tickMs) {
    if (!g || !m) return;
    tickMs = tickMs || 1000 / 60;
    this.list = (m.list || []).filter(function (it) { return it && isFinite(it.x) && isFinite(it.y); }).map(function (it) {
      return { id: it.id, k: it.k === 2 ? 'bomb' : 'trap', x: g.wrap(it.x), y: g.wrap(it.y), o: it.o, atMs: nowMs + (it.l || 0) * tickMs };
    });
    var hasBombs = !!m.bombs;
    for (var k = 0; k < g.players.length; k++) {
      var p = g.players[k], h = (m.held || [])[k] || 0, f = (m.frz || [])[k];
      if (hasBombs) {
        p.traps = (h >= 1 && h <= 9) ? h : 0;
        var b = m.bombs[k] || 0; p.bomb = (b >= 1 && b <= 9) ? b : 0;
      } else if (h === 10) { p.traps = 0; p.bomb = 1; }   // מארח ישן: 10 = פצצה בלבד
      else if (h >= 1 && h <= 9) { p.traps = h; p.bomb = 0; }
      else { p.traps = 0; p.bomb = 0; }
      Items.sync(p);
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
