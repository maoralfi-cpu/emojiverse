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
  // Rim radius = lethal radius; larger outer glow advertises danger without enlarging hitbox.
  Pits.draw = function (c, x, y, scale, now, id, reduced) {
    var r = Pits.RADIUS * scale, a = reduced ? 0 : now / 650 + id * 1.7;
    c.save(); c.translate(x, y); c.scale(r, r);
    c.fillStyle = '#512434'; c.beginPath(); c.ellipse(0, 0.12, 1.35, 1.18, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.18 + 0.08 * Math.sin(a); c.strokeStyle = '#ff6b31'; c.lineWidth = 0.35;
    c.beginPath(); c.arc(0, 0, 1.12, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = '#130e22'; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ff723d'; c.lineWidth = 0.15; c.stroke();
    c.strokeStyle = '#ffd073'; c.lineWidth = 0.065;
    c.beginPath(); c.arc(0, 0, 1.01, 3.5, 5.7); c.stroke();
    c.rotate(a); c.strokeStyle = '#823451'; c.lineWidth = 0.09;
    for (var k = 0; k < 3; k++) {
      c.rotate(Math.PI * 2 / 3); c.beginPath(); c.moveTo(0.08, 0);
      c.bezierCurveTo(0.55, -0.7, 0.9, -0.2, 0.66, 0.48); c.stroke();
    }
    c.fillStyle = '#ffb953';
    for (k = 0; k < (reduced ? 3 : 6); k++) {
      var b = k * 2.399 + a * 0.3, d = 1.24 + 0.13 * Math.sin(a + k);
      c.beginPath(); c.arc(Math.cos(b) * d, Math.sin(b) * d, 0.035 + (k % 2) * 0.02, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pits;
  else root.Pits = Pits;
})(this);
