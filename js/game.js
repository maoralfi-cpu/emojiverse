/* כובש – לוגיקת משחק בתנועה חופשית 360° (ללא DOM). נכתב מאפס.
   עולם רציף בגודל W×W יחידות. השטח נשמר ברשת עדינה (CELL יחידות לתא) לצורך כיבוש;
   השובל הוא קו שבור של נקודות, והתנגשויות נבדקות לפי מרחק נקודה-מקטע. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;

  function Game(opts) {
    opts = opts || {};
    this.W = opts.size || 100;
    this.CELL = 0.5;
    this.G = Math.round(this.W / this.CELL);
    this.SPEED = opts.speed || 9.75;    // יחידות לשנייה
    this.DT = 1 / 60;                   // צעד לוגיקה (60 בשנייה, כמו קצב המסך)
    this.TURN_PER_UNIT = 0.7;           // סיבוב מקסימלי לכל יחידת דרך (רדיוס סיבוב מינימלי ≈1.43 יח' ≈ 1.8 רוחבי שובל)
    this.TURN = opts.turn || this.SPEED * this.TURN_PER_UNIT; // ≈6.8 רד'/ש' (~390°/ש') במהירות ברירת המחדל
    this.AI_EVERY = 2;                  // הבוטים חושבים כל צעד שני (30 בשנייה) – חוסך מעבד
    this.HIT = 0.5;                     // מרחק פגיעה בשובל
    this.HEADON = 1.2;                  // מרחק התנגשות ראש בראש
    this.SPAWN_R = 3.2;
    this.SELF_SKIP = Math.max(4, Math.ceil(1.6 / (this.SPEED * this.DT))); // מקטעים אחרונים (~1.6 יח') שלא נבדקים בשובל העצמי
    this.STAMP_R = 0.55;                // עובי השובל כשהוא הופך לשטח
    var n = this.G * this.G;
    this.owner = new Uint8Array(n);
    this.players = [];
    this.counts = new Int32Array(32);
    this.dirtyCells = [];               // לתמונת המפה הקטנה
    this.dirtyOwners = new Uint8Array(32);
    this.dirtyBox = null;               // [x0,y0,x1,y1] בתאים
    this.events = [];
    this.tickNo = 0;
    this.rand = opts.rand || Math.random;
    this._mark = new Int32Array(n); this._gen = 0; this._queue = new Int32Array(n);
  }
  Game.TAU = TAU;
  var P = Game.prototype;

  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  Game.angDiff = angDiff;
  function segDist2(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = ax + dx * t - px, ey = ay + dy * t - py;
    return ex * ex + ey * ey;
  }
  Game.segDist2 = segDist2;
  /* מרחק (בריבוע) בין שני מקטעים – בדיקה "סוחפת" שמונעת מעבר דרך שובל במהירות גבוהה */
  function segSegDist2(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    var den = d1x * d2y - d1y * d2x;
    if (den !== 0) {
      var t = ((cx - ax) * d2y - (cy - ay) * d2x) / den, u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
    }
    return Math.min(segDist2(ax, ay, cx, cy, dx, dy), segDist2(bx, by, cx, cy, dx, dy), segDist2(cx, cy, ax, ay, bx, by), segDist2(dx, dy, ax, ay, bx, by));
  }
  Game.segSegDist2 = segSegDist2;

  P.cellAt = function (x, y) {
    var cx = Math.floor(x / this.CELL), cy = Math.floor(y / this.CELL);
    if (cx < 0 || cy < 0 || cx >= this.G || cy >= this.G) return -1;
    return cy * this.G + cx;
  };
  P.ownerAt = function (x, y) { var c = this.cellAt(x, y); return c < 0 ? 0 : this.owner[c]; };
  P.inBounds = function (x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.W; };

  P.setOwner = function (i, id) {
    var o = this.owner[i];
    if (o === id) return;
    if (o) { this.counts[o]--; this.dirtyOwners[o] = 1; }
    if (id) { this.counts[id]++; this.dirtyOwners[id] = 1; }
    this.owner[i] = id;
    this.dirtyCells.push(i);
    var G = this.G, x = i % G, y = (i - x) / G, b = this.dirtyBox;
    if (!b) this.dirtyBox = [x, y, x, y];
    else { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  };

  P.addPlayer = function (info) {
    var id = this.players.length + 1;
    var p = {
      id: id, name: info.name || ('P' + id), isBot: !!info.isBot, avatar: info.avatar || 0, emoji: info.emoji || '🙂', color: info.color || '#888',
      x: 0, y: 0, px: 0, py: 0, h: 0, ph: 0, target: 0, turnInput: 0,
      trail: [], tb: [0, 0, 0, 0], alive: false, kills: 0, bestPct: 0, respawnAt: 0, ai: null, deaths: 0, homeX: 0, homeY: 0
    };
    this.players.push(p);
    return p;
  };

  P.findSpawn = function () {
    var W = this.W, R = this.SPAWN_R;
    for (var attempt = 0; attempt < 300; attempt++) {
      var m = R + 4, x = m + this.rand() * (W - 2 * m), y = m + this.rand() * (W - 2 * m);
      var rr = attempt < 150 ? R + 3 : R + 0.5;
      if (!this.areaFree(x, y, rr)) continue;
      if (this.nearAnything(x, y, R + 4)) continue;
      return { x: x, y: y };
    }
    return null;
  };
  P.areaFree = function (x, y, r) {
    var C = this.CELL, G = this.G;
    var x0 = Math.max(0, Math.floor((x - r) / C)), x1 = Math.min(G - 1, Math.floor((x + r) / C));
    var y0 = Math.max(0, Math.floor((y - r) / C)), y1 = Math.min(G - 1, Math.floor((y + r) / C));
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var dx = (cx + 0.5) * C - x, dy = (cy + 0.5) * C - y;
      if (dx * dx + dy * dy <= r * r && this.owner[cy * G + cx]) return false;
    }
    return true;
  };
  P.nearAnything = function (x, y, d) {
    for (var k = 0; k < this.players.length; k++) {
      var q = this.players[k];
      if (!q.alive) continue;
      if (Math.abs(q.x - x) < d && Math.abs(q.y - y) < d) return true;
      var t = q.trail;
      for (var i = 0; i < t.length; i += 2) if (Math.abs(t[i] - x) < d && Math.abs(t[i + 1] - y) < d) return true;
    }
    return false;
  };

  /* מטביע עיגול של תאים כשטח של id */
  P.stamp = function (x, y, r, id) {
    var C = this.CELL, G = this.G;
    var x0 = Math.max(0, Math.floor((x - r) / C)), x1 = Math.min(G - 1, Math.floor((x + r) / C));
    var y0 = Math.max(0, Math.floor((y - r) / C)), y1 = Math.min(G - 1, Math.floor((y + r) / C));
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var dx = (cx + 0.5) * C - x, dy = (cy + 0.5) * C - y;
      if (dx * dx + dy * dy <= r * r) this.setOwner(cy * G + cx, id);
    }
  };

  P.spawn = function (p, at) {
    at = at || this.findSpawn();
    if (!at) return false;
    this.stamp(at.x, at.y, this.SPAWN_R, p.id);
    p.x = p.px = p.homeX = at.x; p.y = p.py = p.homeY = at.y;
    p.h = p.ph = p.target = this.rand() * TAU; p.turnInput = 0;
    p.trail = []; p.alive = true; p.ai = null;
    return true;
  };

  P.setTarget = function (p, a) { p.target = a; };

  P.kill = function (p, killer, reason) {
    if (!p.alive) return;
    p.alive = false; p.deaths++; p.trail = [];
    if (this.counts[p.id] > 0) {
      var o = this.owner, n = o.length;
      for (var j = 0; j < n; j++) if (o[j] === p.id) this.setOwner(j, 0);
    }
    if (killer && killer !== p) killer.kills++;
    this.events.push({ type: 'death', victim: p, killer: killer && killer !== p ? killer : null, reason: reason });
  };

  /* מרחק מינימלי (בריבוע) מנקודה לשובל של q. skip = כמה מקטעים אחרונים לדלג; live = לכלול את המקטע אל הראש */
  P.trailDist2 = function (q, x, y, skip, live) {
    var t = q.trail, n = t.length / 2, best = Infinity;
    if (!n) return best;
    var last = n - 1 - skip;
    for (var i = 0; i < last; i++) {
      var d = segDist2(x, y, t[2 * i], t[2 * i + 1], t[2 * i + 2], t[2 * i + 3]);
      if (d < best) best = d;
    }
    if (live && skip === 0) {
      var d2 = segDist2(x, y, t[2 * n - 2], t[2 * n - 1], q.x, q.y);
      if (d2 < best) best = d2;
    }
    return best;
  };

  /* מרחק מינימלי (בריבוע) ממקטע התנועה a→b לשובל של q */
  P.trailSegDist2 = function (q, ax, ay, bx, by, skip, live) {
    var t = q.trail, n = t.length / 2, best = Infinity;
    if (!n) return best;
    var last = n - 1 - skip;
    for (var i = 0; i < last; i++) {
      var d = segSegDist2(ax, ay, bx, by, t[2 * i], t[2 * i + 1], t[2 * i + 2], t[2 * i + 3]);
      if (d < best) { best = d; if (!d) return 0; }
    }
    if (live && skip === 0) {
      var d2 = segSegDist2(ax, ay, bx, by, t[2 * n - 2], t[2 * n - 1], q.x, q.y);
      if (d2 < best) best = d2;
    }
    return best;
  };

  /* כיבוש: השובל מוטבע כשטח, ואז מילוי מבחוץ – מה שלא נגיש מבחוץ נכבש */
  P.capture = function (p) {
    var id = p.id, t = p.trail, C = this.CELL, G = this.G, k;
    var step = C * 0.5;
    for (k = 0; k + 3 < t.length; k += 2) {
      var ax = t[k], ay = t[k + 1], bx = t[k + 2], by = t[k + 3];
      var len = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(len / step));
      for (var s = 0; s <= m; s++) this.stamp(ax + (bx - ax) * s / m, ay + (by - ay) * s / m, this.STAMP_R, id);
    }
    p.trail = [];
    var owner = this.owner, minX = G, minY = G, maxX = -1, maxY = -1;
    for (var y = 0; y < G; y++) {
      var row = y * G;
      for (var x = 0; x < G; x++) if (owner[row + x] === id) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return 0;
    // שוליים של תא אחד; תא בשולי התיבה שאינו של השחקן נחשב "בחוץ"
    minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1);
    maxX = Math.min(G - 1, maxX + 1); maxY = Math.min(G - 1, maxY + 1);
    var gen = ++this._gen, mark = this._mark, q = this._queue, qh = 0, qt = 0;
    function push(x, y) { var i = y * G + x; if (mark[i] === gen || owner[i] === id) return; mark[i] = gen; q[qt++] = i; }
    for (var xx = minX; xx <= maxX; xx++) { push(xx, minY); push(xx, maxY); }
    for (var yy = minY; yy <= maxY; yy++) { push(minX, yy); push(maxX, yy); }
    while (qh < qt) {
      var i = q[qh++], cx = i % G, cy = (i - cx) / G;
      if (cx > minX) push(cx - 1, cy); if (cx < maxX) push(cx + 1, cy);
      if (cy > minY) push(cx, cy - 1); if (cy < maxY) push(cx, cy + 1);
    }
    var gained = 0, victims = [];
    for (var y2 = minY; y2 <= maxY; y2++) for (var x2 = minX; x2 <= maxX; x2++) {
      var j = y2 * G + x2;
      if (owner[j] !== id && mark[j] !== gen) {
        var prev = owner[j];
        this.setOwner(j, id); gained++;
        if (prev && victims.indexOf(prev) < 0) victims.push(prev);
      }
    }
    for (k = 0; k < victims.length; k++) {
      var vp = this.players[victims[k] - 1];
      if (vp.alive && this.counts[vp.id] <= 0) this.kill(vp, p, 'territory');
    }
    this.events.push({ type: 'capture', player: p, cells: gained });
    return gained;
  };

  /* צעד לוגיקה אחד */
  P.step = function () {
    this.tickNo++;
    var ps = this.players, k, p, dt = this.DT, maxTurn = this.TURN * dt, v = this.SPEED * dt;
    var moving = [];
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.alive) continue;
      p.px = p.x; p.py = p.y; p.ph = p.h;
      if (p.turnInput) p.target = p.h + p.turnInput * maxTurn * 1.01;
      var d = angDiff(p.target, p.h);
      if (d > maxTurn) d = maxTurn; else if (d < -maxTurn) d = -maxTurn;
      p.h += d;
      if (p.h > Math.PI) p.h -= TAU; else if (p.h < -Math.PI) p.h += TAU;
      p.x += Math.cos(p.h) * v; p.y += Math.sin(p.h) * v;
      p.dead = null;
      moving.push(p);
    }
    // קיר
    for (k = 0; k < moving.length; k++) { p = moving[k]; if (!this.inBounds(p.x, p.y)) p.dead = { killer: null, reason: 'wall' }; }
    // ראש בראש
    var H2 = this.HEADON * this.HEADON;
    for (var a = 0; a < moving.length; a++) for (var b = a + 1; b < moving.length; b++) {
      var A = moving[a], B = moving[b];
      if (A.dead || B.dead) continue;
      var dx = A.x - B.x, dy = A.y - B.y;
      if (dx * dx + dy * dy > H2) continue;
      var aHome = this.ownerAt(A.x, A.y) === A.id, bHome = this.ownerAt(B.x, B.y) === B.id;
      if (aHome && bHome) continue;
      if (aHome) B.dead = { killer: A, reason: 'head' };
      else if (bHome) A.dead = { killer: B, reason: 'head' };
      else if (A.trail.length > B.trail.length) A.dead = { killer: B, reason: 'head' };
      else if (B.trail.length > A.trail.length) B.dead = { killer: A, reason: 'head' };
      else { A.dead = { killer: B, reason: 'head' }; B.dead = { killer: A, reason: 'head' }; }
    }
    // פגיעה בשובלים (מרחק נקודה-מקטע)
    var hit2 = this.HIT * this.HIT, trailKills = [];
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (p.dead) continue;
      for (var j = 0; j < ps.length; j++) {
        var q = ps[j];
        if (!q.alive || !q.trail.length) continue;
        var tb = q.tb, ext = this.HIT + 0.5;
        var bx0 = Math.min(tb[0], q.x), by0 = Math.min(tb[1], q.y), bx1 = Math.max(tb[2], q.x), by1 = Math.max(tb[3], q.y);
        if (Math.max(p.x, p.px) < bx0 - ext || Math.min(p.x, p.px) > bx1 + ext || Math.max(p.y, p.py) < by0 - ext || Math.min(p.y, p.py) > by1 + ext) continue;
        if (q === p) {
          if (this.trailSegDist2(p, p.px, p.py, p.x, p.y, this.SELF_SKIP, false) < hit2) { p.dead = { killer: null, reason: 'self' }; break; }
        } else if (this.trailSegDist2(q, p.px, p.py, p.x, p.y, 0, true) < hit2) trailKills.push([q, p]);
      }
    }
    for (k = 0; k < moving.length; k++) { p = moving[k]; if (p.dead) this.kill(p, p.dead.killer, p.dead.reason); }
    for (k = 0; k < trailKills.length; k++) if (trailKills[k][1].alive) this.kill(trailKills[k][0], trailKills[k][1], 'trail');
    // שובל / כיבוש
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (!p.alive) continue;
      var home = this.ownerAt(p.x, p.y) === p.id;
      if (home) {
        if (p.trail.length) { p.trail.push(p.x, p.y); this.capture(p); }
      } else {
        if (!p.trail.length) { p.trail.push(p.px, p.py); p.tb = [p.px, p.py, p.px, p.py]; }
        p.trail.push(p.x, p.y);
        var t = p.tb; if (p.x < t[0]) t[0] = p.x; if (p.y < t[1]) t[1] = p.y; if (p.x > t[2]) t[2] = p.x; if (p.y > t[3]) t[3] = p.y;
      }
    }
    for (k = 0; k < ps.length; k++) { p = ps[k]; if (p.alive) { var pc = this.pct(p); if (pc > p.bestPct) p.bestPct = pc; } }
  };

  P.pct = function (p) { return 100 * this.counts[p.id] / (this.G * this.G); };

  /* חיפוש התא הקרוב ביותר בשטח של השחקן (טבעות מתרחבות). מחזיר נקודה בעולם או null */
  P.nearestOwn = function (p, maxR) {
    var G = this.G, C = this.CELL, cx = Math.floor(p.x / C), cy = Math.floor(p.y / C), o = this.owner, id = p.id;
    maxR = maxR || G;
    for (var r = 1; r <= maxR; r++) {
      var best = -1, bd = Infinity;
      for (var i = -r; i <= r; i++) {
        var pts = [[cx + i, cy - r], [cx + i, cy + r], [cx - r, cy + i], [cx + r, cy + i]];
        for (var k = 0; k < 4; k++) {
          var x = pts[k][0], y = pts[k][1];
          if (x < 0 || y < 0 || x >= G || y >= G) continue;
          if (o[y * G + x] === id) { var d = i * i; if (d < bd) { bd = d; best = y * G + x; } }
        }
      }
      if (best >= 0) { var bx = best % G; return { x: (bx + 0.5) * C, y: ((best - bx) / G + 0.5) * C }; }
    }
    return null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
