/* כובש – לוגיקת משחק בתנועה חופשית 360° (ללא DOM). נכתב מאפס.
   v7: העולם הוא טורוס (W×W יחידות, בלי קצוות): מי שיוצא מימין נכנס משמאל, וכך גם למעלה/למטה.
   - מיקומי שחקנים תמיד בתחום [0,W). השטח נשמר ברשת עדינה (CELL יחידות לתא) עם אינדקסים מודולו G.
   - נקודות השובל נשמרות "פרושות" (רציפות, בלי קפיצה של W בתפר), כך שכל מקטע קצר.
   - כל מרחק/הפרש מחושב לפי הדרך הקצרה ביותר על הטורוס (wd). מקטע של שובל מוזז לעותק
     הקרוב ביותר לנקודה הנבדקת לפני בדיקת ההתנגשות. */
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

  /* הפרש קצר ביותר על מעגל באורך W */
  function wrapDelta(d, W) { d = d % W; if (d > W / 2) d -= W; else if (d < -W / 2) d += W; return d; }
  function mod(a, n) { a = a % n; return a < 0 ? a + n : a; }
  Game.wrapDelta = wrapDelta; Game.mod = mod;
  P.wd = function (d) { return wrapDelta(d, this.W); };
  P.wrap = function (v) { return mod(v, this.W); };
  /* מרחק (בריבוע) על הטורוס */
  P.dist2 = function (ax, ay, bx, by) { var dx = wrapDelta(bx - ax, this.W), dy = wrapDelta(by - ay, this.W); return dx * dx + dy * dy; };

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
    var G = this.G;
    return mod(Math.floor(y / this.CELL), G) * G + mod(Math.floor(x / this.CELL), G);
  };
  P.ownerAt = function (x, y) { return this.owner[this.cellAt(x, y)]; };
  P.inBounds = function () { return true; };   // אין קצוות

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
      var x = this.rand() * W, y = this.rand() * W;      // בכל מקום – אין קצוות
      var rr = attempt < 150 ? R + 3 : R + 0.5;
      if (!this.areaFree(x, y, rr)) continue;
      if (this.nearAnything(x, y, R + 4)) continue;
      return { x: x, y: y };
    }
    return null;
  };
  P.areaFree = function (x, y, r) {
    var C = this.CELL, G = this.G;
    var x0 = Math.floor((x - r) / C), x1 = Math.floor((x + r) / C), y0 = Math.floor((y - r) / C), y1 = Math.floor((y + r) / C);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var dx = (cx + 0.5) * C - x, dy = (cy + 0.5) * C - y;
      if (dx * dx + dy * dy <= r * r && this.owner[mod(cy, G) * G + mod(cx, G)]) return false;
    }
    return true;
  };
  /* מרווח מינימלי מכל שחקן ושובל – לפי מרחק על הטורוס */
  P.nearAnything = function (x, y, d) {
    var W = this.W;
    for (var k = 0; k < this.players.length; k++) {
      var q = this.players[k];
      if (!q.alive) continue;
      if (Math.abs(wrapDelta(q.x - x, W)) < d && Math.abs(wrapDelta(q.y - y, W)) < d) return true;
      var t = q.trail;
      for (var i = 0; i < t.length; i += 2) if (Math.abs(wrapDelta(t[i] - x, W)) < d && Math.abs(wrapDelta(t[i + 1] - y, W)) < d) return true;
    }
    return false;
  };

  /* מטביע עיגול של תאים כשטח של id */
  P.stamp = function (x, y, r, id) {
    var C = this.CELL, G = this.G;
    var x0 = Math.floor((x - r) / C), x1 = Math.floor((x + r) / C), y0 = Math.floor((y - r) / C), y1 = Math.floor((y + r) / C);
    for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
      var dx = (cx + 0.5) * C - x, dy = (cy + 0.5) * C - y;
      if (dx * dx + dy * dy <= r * r) this.setOwner(mod(cy, G) * G + mod(cx, G), id);
    }
  };

  P.spawn = function (p, at) {
    at = at || this.findSpawn();
    if (!at) return false;
    this.stamp(at.x, at.y, this.SPAWN_R, p.id);
    at = { x: mod(at.x, this.W), y: mod(at.y, this.W) };
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
    var t = q.trail, n = t.length / 2, best = Infinity, W = this.W;
    if (!n) return best;
    var last = n - 1 - skip;
    for (var i = 0; i < last; i++) {
      var ax = t[2 * i], ay = t[2 * i + 1];
      // הנקודה מועתקת לעותק הקרוב ביותר לתחילת המקטע
      var d = segDist2(ax + wrapDelta(x - ax, W), ay + wrapDelta(y - ay, W), ax, ay, t[2 * i + 2], t[2 * i + 3]);
      if (d < best) best = d;
    }
    if (live && skip === 0) {
      var lx = t[2 * n - 2], ly = t[2 * n - 1];
      var d2 = segDist2(lx + wrapDelta(x - lx, W), ly + wrapDelta(y - ly, W), lx, ly, lx + wrapDelta(q.x - lx, W), ly + wrapDelta(q.y - ly, W));
      if (d2 < best) best = d2;
    }
    return best;
  };

  /* מרחק מינימלי (בריבוע) ממקטע התנועה a→b לשובל של q */
  /* a→b = מקטע התנועה (b כבר "פרוש" ביחס ל-a). לכל מקטע שובל מזיזים את a→b לעותק הקרוב אליו */
  P.trailSegDist2 = function (q, ax, ay, bx, by, skip, live) {
    var t = q.trail, n = t.length / 2, best = Infinity, W = this.W;
    if (!n) return best;
    var last = n - 1 - skip;
    for (var i = 0; i < last; i++) {
      var cx = t[2 * i], cy = t[2 * i + 1];
      var sx = cx + wrapDelta(ax - cx, W) - ax, sy = cy + wrapDelta(ay - cy, W) - ay;
      var d = segSegDist2(ax + sx, ay + sy, bx + sx, by + sy, cx, cy, t[2 * i + 2], t[2 * i + 3]);
      if (d < best) { best = d; if (!d) return 0; }
    }
    if (live && skip === 0) {
      var lx = t[2 * n - 2], ly = t[2 * n - 1];
      var ox = lx + wrapDelta(ax - lx, W) - ax, oy = ly + wrapDelta(ay - ly, W) - ay;
      var d2 = segSegDist2(ax + ox, ay + oy, bx + ox, by + oy, lx, ly, lx + wrapDelta(q.x - lx, W), ly + wrapDelta(q.y - ly, W));
      if (d2 < best) best = d2;
    }
    return best;
  };

  /* כיבוש על טורוס: אין "בחוץ". השובל מוטבע כשטח; אחר כך מחלקים את כל התאים שאינם של השחקן
     לרכיבי קשירות (4 שכנים, עם עטיפה). הרכיב הגדול ביותר נשאר; כל השאר – נכבשים.
     לולאה שמקיפה את הטורוס (לא כוויצה) לא מפרידה כלום => רכיב אחד => נכבש רק השובל עצמו. */
  P.capture = function (p) {
    var id = p.id, t = p.trail, C = this.CELL, G = this.G, k;
    var step = C * 0.5;
    for (k = 0; k + 3 < t.length; k += 2) {
      var ax = t[k], ay = t[k + 1], bx = t[k + 2], by = t[k + 3];
      var len = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(len / step));
      for (var s = 0; s <= m; s++) this.stamp(ax + (bx - ax) * s / m, ay + (by - ay) * s / m, this.STAMP_R, id);
    }
    p.trail = [];
    var comps = this.components(id);
    if (comps.count <= 1) { this.events.push({ type: 'capture', player: p, cells: 0 }); return 0; }
    var big = 0; for (k = 1; k < comps.count; k++) if (comps.size[k] > comps.size[big]) big = k;
    var owner = this.owner, mark = this._mark, base = comps.base, n = owner.length, gained = 0, victims = [];
    for (var j = 0; j < n; j++) {
      var c = mark[j] - base;
      if (c < 0 || c === big || owner[j] === id) continue;
      var prev = owner[j];
      this.setOwner(j, id); gained++;
      if (prev && victims.indexOf(prev) < 0) victims.push(prev);
    }
    for (k = 0; k < victims.length; k++) {
      var vp = this.players[victims[k] - 1];
      if (vp.alive && this.counts[vp.id] <= 0) this.kill(vp, p, 'territory');
    }
    this.events.push({ type: 'capture', player: p, cells: gained });
    return gained;
  };
  /* רכיבי קשירות של התאים שאינם של id (4 שכנים, עוטף). mark[i] = base + מס' רכיב */
  P.components = function (id) {
    var G = this.G, owner = this.owner, n = owner.length, mark = this._mark, q = this._queue;
    var base = this._gen + 1, count = 0, size = [];
    for (var s0 = 0; s0 < n; s0++) {
      if (owner[s0] === id || mark[s0] >= base) continue;
      var cid = base + count, qh = 0, qt = 0, sz = 0;
      mark[s0] = cid; q[qt++] = s0;
      while (qh < qt) {
        var i = q[qh++], x = i % G, y = (i - x) / G, nb; sz++;
        nb = y * G + (x ? x - 1 : G - 1); if (owner[nb] !== id && mark[nb] < base) { mark[nb] = cid; q[qt++] = nb; }
        nb = y * G + (x < G - 1 ? x + 1 : 0); if (owner[nb] !== id && mark[nb] < base) { mark[nb] = cid; q[qt++] = nb; }
        nb = (y ? y - 1 : G - 1) * G + x; if (owner[nb] !== id && mark[nb] < base) { mark[nb] = cid; q[qt++] = nb; }
        nb = (y < G - 1 ? y + 1 : 0) * G + x; if (owner[nb] !== id && mark[nb] < base) { mark[nb] = cid; q[qt++] = nb; }
      }
      size.push(sz); count++;
    }
    this._gen = base + count;
    return { count: count, size: size, base: base };
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
      p.ux = p.px + Math.cos(p.h) * v; p.uy = p.py + Math.sin(p.h) * v;   // סוף מקטע התנועה, לא עטוף
      p.x = mod(p.x, this.W); p.y = mod(p.y, this.W);                       // עטיפה: אין קיר
      p.dead = null;
      moving.push(p);
    }
    // ראש בראש
    var H2 = this.HEADON * this.HEADON;
    for (var a = 0; a < moving.length; a++) for (var b = a + 1; b < moving.length; b++) {
      var A = moving[a], B = moving[b];
      if (A.dead || B.dead) continue;
      if (this.dist2(A.x, A.y, B.x, B.y) > H2) continue;
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
        if (!this.boxNear(q, p, this.HIT + 0.5)) continue;
        if (q === p) {
          if (this.trailSegDist2(p, p.px, p.py, p.ux, p.uy, this.SELF_SKIP, false) < hit2) { p.dead = { killer: null, reason: 'self' }; break; }
        } else if (this.trailSegDist2(q, p.px, p.py, p.ux, p.uy, 0, true) < hit2) trailKills.push([q, p]);
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
        if (p.trail.length) { var tl0 = p.trail.length; p.trail.push(p.trail[tl0 - 2] + this.wd(p.x - p.trail[tl0 - 2]), p.trail[tl0 - 1] + this.wd(p.y - p.trail[tl0 - 1])); this.capture(p); }
      } else {
        if (!p.trail.length) { p.trail.push(p.px, p.py); p.tb = [p.px, p.py, p.px, p.py]; }
        // נקודה חדשה "פרושה" ביחס לקודמת – השובל רציף גם כשחוצים את התפר
        var tl = p.trail.length, nx = p.trail[tl - 2] + this.wd(p.x - p.trail[tl - 2]), ny = p.trail[tl - 1] + this.wd(p.y - p.trail[tl - 1]);
        p.trail.push(nx, ny);
        var t = p.tb; if (nx < t[0]) t[0] = nx; if (ny < t[1]) t[1] = ny; if (nx > t[2]) t[2] = nx; if (ny > t[3]) t[3] = ny;
      }
    }
    for (k = 0; k < ps.length; k++) { p = ps[k]; if (p.alive) { var pc = this.pct(p); if (pc > p.bestPct) p.bestPct = pc; } }
  };

  /* סינון מהיר: האם מקטע התנועה של p קרוב לתיבה התוחמת של השובל של q (עם עטיפה) */
  P.boxNear = function (q, p, ext) {
    var tb = q.tb, W = this.W;
    var x0 = Math.min(tb[0], tb[0] + this.wd(q.x - tb[0])), x1 = Math.max(tb[2], tb[0] + this.wd(q.x - tb[0]));
    var y0 = Math.min(tb[1], tb[1] + this.wd(q.y - tb[1])), y1 = Math.max(tb[3], tb[1] + this.wd(q.y - tb[1]));
    if (x1 - x0 + 2 * ext >= W / 2 || y1 - y0 + 2 * ext >= W / 2) return true;   // שובל ארוך – בודקים הכול
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var ax = cx + this.wd(p.px - cx), ay = cy + this.wd(p.py - cy), bx = ax + (p.ux - p.px), by = ay + (p.uy - p.py);
    return !(Math.max(ax, bx) < x0 - ext || Math.min(ax, bx) > x1 + ext || Math.max(ay, by) < y0 - ext || Math.min(ay, by) > y1 + ext);
  };

  P.pct = function (p) { return 100 * this.counts[p.id] / (this.G * this.G); };

  /* חיפוש התא הקרוב ביותר בשטח של השחקן (טבעות מתרחבות). מחזיר נקודה בעולם או null */
  P.nearestOwn = function (p, maxR) {
    var G = this.G, C = this.CELL, cx = Math.floor(p.x / C), cy = Math.floor(p.y / C), o = this.owner, id = p.id;
    maxR = Math.min(maxR || G, G >> 1);
    var best = null;
    for (var r = 1; r <= maxR; r++) {
      var bd = Infinity; best = null;
      for (var i = -r; i <= r; i++) {
        var pts = [[cx + i, cy - r], [cx + i, cy + r], [cx - r, cy + i], [cx + r, cy + i]];
        for (var k = 0; k < 4; k++) {
          var x = pts[k][0], y = pts[k][1];
          var wx = mod(x, G), wy = mod(y, G);
          if (o[wy * G + wx] === id) { var d = i * i; if (d < bd) { bd = d; best = [x, y]; } }
        }
      }
      // נקודה "פרושה" ליד השחקן (עלולה להיות מחוץ ל-[0,W) – משתמשים בהפרש עטוף)
      if (best) return { x: (best[0] + 0.5) * C, y: (best[1] + 0.5) * C };
    }
    return null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
