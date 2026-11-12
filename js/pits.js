/* v9.9 Trap craters: persistent match layout; only solo/host Game.step runs collisions.
   Gemini Flash mechanical draft reviewed/adapted: no isHost flag (solo must work),
   unwrapped swept segment, safe respawns, bounded sync, shared collision radius. */
(function (root) {
  'use strict';
  function Pits() { this.pits = []; }
  Pits.RADIUS = 1.15;
  Pits.maxFor = function (W) { return Math.max(3, Math.min(5, Math.round(W / 26))); };
  var P = Pits.prototype;
  P.reset = function () { this.pits.length = 0; };
  P.dangerAt = function (g, x, y, margin) {
    for (var i = 0; i < this.pits.length; i++) {
      var h = this.pits[i], r = h.r + (margin || 0);
      if (g.dist2(x, y, h.x, h.y) <= r * r) return true;
    }
    return false;
  };
  P.seed = function (g, packs) {
    this.reset();
    for (var a = 0; a < 500 && this.pits.length < Pits.maxFor(g.W); a++) {
      var x = Math.round(g.rand() * g.W * 100) / 100, y = Math.round(g.rand() * g.W * 100) / 100, ok = true, i;
      x = g.wrap(x); y = g.wrap(y);
      for (i = 0; i < g.players.length; i++) {
        var p = g.players[i];
        if (p.alive && g.dist2(x, y, p.x, p.y) < 64) { ok = false; break; }
      }
      if (!ok || this.dangerAt(g, x, y, 12 - Pits.RADIUS)) continue;
      var list = packs ? packs.packs : [];
      for (i = 0; i < list.length; i++) if (g.dist2(x, y, list[i].x, list[i].y) < 16) { ok = false; break; }
      if (ok) this.pits.push({ id: this.pits.length + 1, x: x, y: y, r: Pits.RADIUS });
    }
  };
  P.tick = function (g) {
    for (var i = 0; i < g.players.length; i++) {
      var p = g.players[i]; if (!p.alive) continue;
      // ux/uy are the actual unwrapped end of this movement, not the long seam jump.
      var ax = p.px, ay = p.py, dx = p.ux - ax, dy = p.uy - ay, len2 = dx * dx + dy * dy;
      for (var j = 0; j < this.pits.length; j++) {
        var h = this.pits[j], hx = g.wd(h.x - ax), hy = g.wd(h.y - ay);
        var t = len2 ? Math.max(0, Math.min(1, (hx * dx + hy * dy) / len2)) : 0;
        var ex = hx - t * dx, ey = hy - t * dy;
        if (ex * ex + ey * ey <= h.r * h.r) { g.kill(p, null, 'pit'); break; }
      }
    }
  };
  P.publicList = function () {
    return this.pits.map(function (h) { return { id: h.id, x: h.x, y: h.y }; });
  };
  P.applySync = function (g, list) {
    this.reset();
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length && this.pits.length < Pits.maxFor(g.W); i++) {
      var h = list[i];
      if (!h || typeof h.x !== 'number' || typeof h.y !== 'number' || !isFinite(h.x) || !isFinite(h.y)) continue;
      this.pits.push({ id: i + 1, x: g.wrap(h.x), y: g.wrap(h.y), r: Pits.RADIUS });
    }
  };
  // Small fixed geometry, no per-frame particle arrays, gradients or sprites to rebuild.
  // Rim sits at the lethal radius; a modest outer glow advertises danger without enlarging the hitbox.
  Pits.draw = function (c, x, y, scale, now, id, reduced) {
    var r = Pits.RADIUS * scale, t = reduced ? 0 : now / 800 + id * 1.3, pulse = reduced ? 0 : 0.05 * Math.sin(t);
    var i, a, rr, sx, sy, n = reduced ? 6 : 8;
    c.save(); c.translate(x, y); c.scale(r, r);
    // הילה חיצונית – סימון סכנה בלי להגדיל את רדיוס הפגיעה
    c.globalAlpha = 0.20 + pulse; c.fillStyle = '#ff5a1f';
    c.beginPath(); c.ellipse(0, 0.06, 1.32, 1.18, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    // שפת סלע חומה-אוכרה: אבנים חופפות סביב השפה, כדי שזה ייראה כבור באדמה
    for (i = 0; i < n; i++) {
      a = i * Math.PI * 2 / n + id * 0.37;
      rr = 0.90 + 0.10 * Math.sin(id * 2.3 + i * 1.9);
      sx = Math.cos(a) * 0.92; sy = Math.sin(a) * 0.80 + 0.05;
      c.fillStyle = (i + id) % 2 ? '#7a4a24' : '#5c3518';
      c.beginPath(); c.ellipse(sx, sy, 0.40 * rr, 0.28 * rr, a, 0, Math.PI * 2); c.fill();
      if (!reduced && i % 2 === 0) {
        c.fillStyle = '#9a6a38';
        c.beginPath(); c.ellipse(sx - 0.04, sy - 0.05, 0.18 * rr, 0.12 * rr, a, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = '#3d2414'; c.beginPath(); c.ellipse(0, 0.04, 0.98, 0.86, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3a22'; c.beginPath(); c.ellipse(0, 0.03, 0.90, 0.78, 0, 0, Math.PI * 2); c.fill();
    // טבעת לבה כתומה-אדומה עם הדגשת צהוב, ופעימה עדינה
    c.strokeStyle = '#d32a08'; c.lineWidth = 0.20 + pulse;
    c.beginPath(); c.ellipse(0, 0.02, 0.78, 0.68, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ff7a18'; c.lineWidth = 0.12;
    c.beginPath(); c.ellipse(0, 0.02, 0.70, 0.60, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffd56a'; c.lineWidth = 0.05 + (reduced ? 0 : 0.02 * Math.sin(t + 1));
    c.beginPath(); c.ellipse(0, 0.02, 0.64, 0.55, 0, 0, Math.PI * 2); c.stroke();
    // לוע כהה
    c.fillStyle = '#120805'; c.beginPath(); c.ellipse(0, 0.03, 0.56, 0.47, 0, 0, Math.PI * 2); c.fill();
    // ברק על הלבה
    c.strokeStyle = 'rgba(255,245,200,0.9)'; c.lineWidth = 0.055;
    c.beginPath(); c.ellipse(0, 0.02, 0.68, 0.58, 0, 3.5, 5.3); c.stroke();
    if (!reduced) {
      var b1 = 0.055 + 0.02 * Math.sin(t * 1.5), b2 = 0.04 + 0.015 * Math.sin(t * 1.2 + 2);
      c.fillStyle = 'rgba(255,210,90,0.85)';
      c.beginPath(); c.arc(0.52, -0.28, b1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-0.40, 0.30, b2, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,230,0.75)';
      c.beginPath(); c.arc(0.50, -0.30, b1 * 0.35, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pits;
  else root.Pits = Pits;
})(this);
