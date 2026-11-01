/* כובש – לוגיקת משחק (ללא DOM). נכתב מאפס. */
(function (root) {
  'use strict';
  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // 0=ימין 1=למטה 2=שמאל 3=למעלה

  function Game(opts) {
    opts = opts || {};
    this.N = opts.size || 100;
    var n = this.N * this.N;
    this.owner = new Uint8Array(n);   // 0 = ריק, אחרת מזהה שחקן
    this.trail = new Uint8Array(n);   // 0 = אין שובל
    this.players = [];                // לפי מזהה-1
    this.counts = new Int32Array(32);
    this.dirty = [];                  // תאים שהשתנו (לציור)
    this.allDirty = true;
    this.events = [];                 // {type:'kill'|'death'|'capture', ...}
    this.tickNo = 0;
    this.rand = opts.rand || Math.random;
    this._mark = new Int32Array(n);
    this._gen = 0;
    this._queue = new Int32Array(n);
    this._prev = new Int32Array(n);
  }
  Game.DX = DX; Game.DY = DY;
  var P = Game.prototype;

  P.idx = function (x, y) { return y * this.N + x; };
  P.inBounds = function (x, y) { return x >= 0 && y >= 0 && x < this.N && y < this.N; };

  P.setOwner = function (i, id) {
    var o = this.owner[i];
    if (o === id) return;
    if (o) this.counts[o]--;
    if (id) this.counts[id]++;
    this.owner[i] = id;
    this.dirty.push(i);
  };
  P.setTrail = function (i, id) {
    if (this.trail[i] === id) return;
    this.trail[i] = id;
    this.dirty.push(i);
  };

  P.addPlayer = function (info) {
    var id = this.players.length + 1;
    var p = {
      id: id, name: info.name || ('P' + id), isBot: !!info.isBot, avatar: info.avatar || 0,
      color: info.color || 0, x: 0, y: 0, px: 0, py: 0, dir: 0, queue: [], trailCells: [],
      alive: false, kills: 0, bestPct: 0, respawnAt: 0, ai: null, deaths: 0
    };
    this.players.push(p);
    return p;
  };

  /* מציאת מקום פנוי ללידה */
  P.findSpawn = function (r) {
    var N = this.N;
    for (var attempt = 0; attempt < 400; attempt++) {
      var m = r + 3;
      var cx = m + Math.floor(this.rand() * (N - 2 * m));
      var cy = m + Math.floor(this.rand() * (N - 2 * m));
      var ok = true;
      var rr = attempt < 200 ? r + 2 : r;
      for (var y = cy - rr; y <= cy + rr && ok; y++)
        for (var x = cx - rr; x <= cx + rr; x++) {
          var i = this.idx(x, y);
          if (this.owner[i] || this.trail[i]) { ok = false; break; }
        }
      if (ok && !this.headNear(cx, cy, r + 3)) return { x: cx, y: cy };
    }
    return null;
  };
  P.headNear = function (x, y, d) {
    for (var k = 0; k < this.players.length; k++) {
      var q = this.players[k];
      if (q.alive && Math.abs(q.x - x) <= d && Math.abs(q.y - y) <= d) return true;
    }
    return false;
  };

  P.spawn = function (p, at) {
    var r = 2;
    at = at || this.findSpawn(r);
    if (!at) return false;
    for (var y = at.y - r; y <= at.y + r; y++)
      for (var x = at.x - r; x <= at.x + r; x++) {
        var i = this.idx(x, y);
        if (this.trail[i]) continue;
        this.setOwner(i, p.id);
      }
    p.x = p.px = at.x; p.y = p.py = at.y;
    p.dir = Math.floor(this.rand() * 4); p.queue.length = 0;
    p.trailCells = []; p.alive = true; p.kills = p.kills || 0; p.ai = null;
    return true;
  };

  P.turn = function (p, d) {
    if (!p.alive) return;
    var last = p.queue.length ? p.queue[p.queue.length - 1] : p.dir;
    if (d === last || (d + 2) % 4 === last) return; // לא פונים לאחור
    if (p.queue.length < 2) p.queue.push(d);
  };

  P.kill = function (p, killer, reason) {
    if (!p.alive) return;
    p.alive = false; p.deaths++;
    for (var k = 0; k < p.trailCells.length; k++) {
      var i = p.trailCells[k];
      if (this.trail[i] === p.id) this.setTrail(i, 0);
    }
    p.trailCells = [];
    var N2 = this.N * this.N;
    if (this.counts[p.id] > 0)
      for (var j = 0; j < N2; j++) if (this.owner[j] === p.id) this.setOwner(j, 0);
    if (killer && killer !== p) killer.kills++;
    this.events.push({ type: 'death', victim: p, killer: killer && killer !== p ? killer : null, reason: reason });
  };

  /* כיבוש: השובל הופך לשטח, וכל מה שלא נגיש מבחוץ – נכבש */
  P.capture = function (p) {
    var id = p.id, N = this.N, k;
    for (k = 0; k < p.trailCells.length; k++) {
      var c = p.trailCells[k];
      this.setTrail(c, 0);
      this.setOwner(c, id);
    }
    p.trailCells = [];
    // תיבה תוחמת של שטח השחקן + שוליים
    var minX = N, minY = N, maxX = -1, maxY = -1, owner = this.owner;
    for (var y = 0; y < N; y++) {
      var row = y * N;
      for (var x = 0; x < N; x++) if (owner[row + x] === id) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return 0;
    // מרחיבים בתא אחד (בתוך גבולות המפה). כל תא בשולי התיבה שאינו של השחקן נחשב "בחוץ",
    // כי הוא או מחוץ לתיבה התוחמת או על גבול המפה.
    minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1);
    maxX = Math.min(N - 1, maxX + 1); maxY = Math.min(N - 1, maxY + 1);
    var gen = ++this._gen, mark = this._mark, q = this._queue, qh = 0, qt = 0;
    function push(x, y) {
      var i = y * N + x;
      if (mark[i] === gen || owner[i] === id) return;
      mark[i] = gen; q[qt++] = i;
    }
    for (var xx = minX; xx <= maxX; xx++) { push(xx, minY); push(xx, maxY); }
    for (var yy = minY; yy <= maxY; yy++) { push(minX, yy); push(maxX, yy); }
    while (qh < qt) {
      var i = q[qh++], cx = i % N, cy = (i - cx) / N;
      if (cx > minX) push(cx - 1, cy);
      if (cx < maxX) push(cx + 1, cy);
      if (cy > minY) push(cx, cy - 1);
      if (cy < maxY) push(cx, cy + 1);
    }
    var gained = 0;
    var x0 = minX, x1 = maxX, y0 = minY, y1 = maxY;
    for (var y2 = y0; y2 <= y1; y2++) for (var x2 = x0; x2 <= x1; x2++) {
      var j = y2 * N + x2;
      if (owner[j] !== id && mark[j] !== gen) {
        var prevOwner = owner[j];
        this.setOwner(j, id); gained++;
        if (prevOwner && this.counts[prevOwner] <= 0) {
          var vp = this.players[prevOwner - 1];
          if (vp.alive) this.kill(vp, p, 'territory');
        }
      }
    }
    this.events.push({ type: 'capture', player: p, cells: gained });
    return gained;
  };

  /* צעד לוגיקה אחד (כל השחקנים זזים תא אחד) */
  P.step = function () {
    this.tickNo++;
    var ps = this.players, N = this.N, k, p;
    var moving = [];
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.alive) continue;
      if (p.queue.length) p.dir = p.queue.shift();
      p.px = p.x; p.py = p.y;
      p.nx = p.x + DX[p.dir]; p.ny = p.y + DY[p.dir];
      p.dead = null;
      moving.push(p);
    }
    // קיר
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (!this.inBounds(p.nx, p.ny)) p.dead = { killer: null, reason: 'wall' };
    }
    // התנגשות ראש בראש (אותו תא או החלפת מקומות)
    for (var a = 0; a < moving.length; a++) for (var b = a + 1; b < moving.length; b++) {
      var A = moving[a], B = moving[b];
      if (A.dead || B.dead) continue;
      var same = A.nx === B.nx && A.ny === B.ny;
      var swap = A.nx === B.x && A.ny === B.y && B.nx === A.x && B.ny === A.y;
      if (!same && !swap) continue;
      var aHome = this.inBounds(A.nx, A.ny) && this.owner[this.idx(A.nx, A.ny)] === A.id;
      var bHome = this.inBounds(B.nx, B.ny) && this.owner[this.idx(B.nx, B.ny)] === B.id;
      if (aHome && !bHome) B.dead = { killer: A, reason: 'head' };
      else if (bHome && !aHome) A.dead = { killer: B, reason: 'head' };
      else if (A.trailCells.length > B.trailCells.length) A.dead = { killer: B, reason: 'head' };
      else if (B.trailCells.length > A.trailCells.length) B.dead = { killer: A, reason: 'head' };
      else { A.dead = { killer: B, reason: 'head' }; B.dead = { killer: A, reason: 'head' }; }
    }
    // חציית שובלים
    var trailKills = [];
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (p.dead) continue;
      var t = this.trail[this.idx(p.nx, p.ny)];
      if (!t) continue;
      if (t === p.id) p.dead = { killer: null, reason: 'self' };
      else trailKills.push([ps[t - 1], p]);
    }
    // תזוזה
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (p.dead) continue;
      p.x = p.nx; p.y = p.ny;
    }
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (p.dead) this.kill(p, p.dead.killer, p.dead.reason);
    }
    for (k = 0; k < trailKills.length; k++) this.kill(trailKills[k][0], trailKills[k][1], 'trail');
    // שובל / כיבוש
    for (k = 0; k < moving.length; k++) {
      p = moving[k];
      if (!p.alive) continue;
      var i = this.idx(p.x, p.y);
      if (this.owner[i] === p.id) {
        if (p.trailCells.length) this.capture(p);
      } else {
        this.setTrail(i, p.id);
        p.trailCells.push(i);
      }
    }
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (p.alive) { var pc = this.pct(p); if (pc > p.bestPct) p.bestPct = pc; }
    }
  };

  P.pct = function (p) { return 100 * this.counts[p.id] / (this.N * this.N); };

  /* BFS כללי: הצעד הראשון לעבר תא שמקיים goal, תוך הימנעות מהשובל של עצמו */
  P.bfsFirstStep = function (p, goal, maxNodes) {
    var N = this.N, gen = ++this._gen, mark = this._mark, q = this._queue, prev = this._prev;
    var start = this.idx(p.x, p.y), qh = 0, qt = 0;
    mark[start] = gen; prev[start] = -1;
    // הצעד הראשון לא יכול להיות לאחור
    for (var d0 = 0; d0 < 4; d0++) {
      if (d0 === (p.dir + 2) % 4) continue;
      var x = p.x + DX[d0], y = p.y + DY[d0];
      if (!this.inBounds(x, y)) continue;
      var i = y * N + x;
      if (this.trail[i] === p.id || mark[i] === gen) continue;
      mark[i] = gen; prev[i] = d0; q[qt++] = i;
    }
    var nodes = 0;
    while (qh < qt && nodes++ < maxNodes) {
      var c = q[qh++];
      if (goal(c)) return prev[c];
      var cx = c % N, cy = (c - cx) / N;
      for (var d = 0; d < 4; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        var j = ny * N + nx;
        if (mark[j] === gen || this.trail[j] === p.id) continue;
        mark[j] = gen; prev[j] = prev[c]; q[qt++] = j;
      }
    }
    return -1;
  };

  /* כמה תאים נגישים מתא (מוגבל) – למניעת היכלאות */
  P.space = function (p, x, y, limit) {
    var N = this.N, gen = ++this._gen, mark = this._mark, q = this._queue, qh = 0, qt = 0;
    var s = y * N + x; mark[s] = gen; q[qt++] = s;
    while (qh < qt && qt < limit) {
      var c = q[qh++], cx = c % N, cy = (c - cx) / N;
      for (var d = 0; d < 4; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        var j = ny * N + nx;
        if (mark[j] === gen || this.trail[j] === p.id) continue;
        mark[j] = gen; q[qt++] = j;
      }
    }
    return qt;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
