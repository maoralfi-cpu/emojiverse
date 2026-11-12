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
  // v9.12: באר תלת-ממדית נקייה (בהשראת רינדור CGI): שפת מתכת/בטון אפורה-כסופה, דפנות פנימיות
  // מוצללות ותחתית כמעט שחורה, במבט מעט מלמעלה-מלפנים. בלי לבה, בלי חלקיקים ובלי מערכים לכל פריים.
  // הגרדיאנטים מוגדרים ביחידות של רדיוס הפגיעה ונשמרים פעם אחת לכל הקשר ציור (canvas מפרש אותם
  // במערכת הצירים בזמן המילוי, אז אותו אובייקט משמש לכל בור ולכל זום).
  var G = Object.freeze({
    // פתח: אליפסה רחבה (≈1.7:1) – פרספקטיבה קלה שעדיין מכסה את עיגול הפגיעה
    OX: 0.74, OY: 0.43, OC: -0.02,
    // משטח עליון של השפה ודופן חיצונית שמראה עובי
    TX: 1.05, TY: 0.70, SIDE: 0.17,
    // עומק: כמה התחתית "יורדת" על המסך
    DEPTH: 0.36
  });
  Pits.GEOM = G;
  function grads(c) {
    if (c.__pitGrads) return c.__pitGrads;
    var g = {}, l;
    l = c.createLinearGradient(0, -G.TY, 0, G.TY + G.SIDE);          // דופן חיצונית: אפור בינוני שמתכהה למטה
    l.addColorStop(0, '#9ca2aa'); l.addColorStop(1, '#5b6169'); g.side = l;
    l = c.createLinearGradient(-G.TX * 0.5, -G.TY, G.TX * 0.3, G.TY);   // משטח עליון: הכי בהיר, אור מלמעלה-משמאל
    l.addColorStop(0, '#f1f3f5'); l.addColorStop(0.55, '#cfd4da'); l.addColorStop(1, '#aab0b8'); g.top = l;
    l = c.createLinearGradient(-G.OX, 0, G.OX, 0);                     // דפנות פנימיות: צד שמאל בהיר, ימין כהה
    l.addColorStop(0, '#8e949c'); l.addColorStop(0.45, '#60666e'); l.addColorStop(1, '#2c3036'); g.wall = l;
    l = c.createLinearGradient(0, G.OC - G.OY, 0, G.OC + G.OY);        // הדפנות מחשיכות לכיוון העומק
    l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(0.55, 'rgba(0,0,0,0.45)'); l.addColorStop(1, 'rgba(0,0,0,0.8)'); g.depth = l;
    var by = G.OC + G.DEPTH;                                           // תחתית: קצה רחוק מעט בהיר מאור סביבתי
    l = c.createRadialGradient(0, by + 0.10, 0.05, 0, by - 0.05, G.OX);
    l.addColorStop(0, '#050607'); l.addColorStop(0.7, '#0c0e11'); l.addColorStop(1, '#23262b'); g.floor = l;
    c.__pitGrads = g;
    return g;
  }
  function oval(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  Pits.draw = function (c, x, y, scale, now, id, reduced) {
    var r = Pits.RADIUS * scale, g = grads(c);
    // הבהוב עדין מאוד של ההברקה במצב מלא; במופחת – סטטי לגמרי
    var shine = reduced ? 0.62 : 0.56 + 0.10 * Math.sin(now / 1400 + id * 1.7);
    c.save(); c.translate(x, y); c.scale(r, r);
    // צל מגע רך על המפה – מבליט את הבור על רקע פסטל ומסמן את אזור הסכנה
    c.fillStyle = 'rgba(30,35,45,0.20)'; oval(c, 0.04, 0.16, 1.16, 0.90); c.fill();
    // דופן חיצונית (עובי השפה)
    c.fillStyle = g.side; oval(c, 0, G.SIDE, G.TX, G.TY); c.fill();
    // משטח עליון של השפה
    c.fillStyle = g.top; oval(c, 0, 0, G.TX, G.TY); c.fill();
    // שפה פנימית כהה במקום שבו השפה פוגשת את הפיר
    c.fillStyle = '#4a4f56'; oval(c, 0, G.OC + 0.015, G.OX + 0.07, G.OY + 0.055); c.fill();
    // הפיר: דפנות + תחתית, חתוכים לפתח
    c.save(); oval(c, 0, G.OC, G.OX, G.OY); c.clip();
    c.fillStyle = g.wall; c.fillRect(-G.OX, G.OC - G.OY, G.OX * 2, G.OY * 2);
    c.fillStyle = g.depth; c.fillRect(-G.OX, G.OC - G.OY, G.OX * 2, G.OY * 2);
    c.fillStyle = g.floor; oval(c, 0, G.OC + G.DEPTH, G.OX * 0.93, G.OY * 0.93); c.fill();
    if (!reduced) {  // צל מגע פנימי מתחת לשפה הקרובה
      c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.10;
      c.beginPath(); c.ellipse(0, G.OC, G.OX, G.OY, 0, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    }
    c.restore();
    // הברקות: קצה עליון (רחוק) וקצה קדמי של השפה, ושוליים פנימיים קדמיים
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,' + shine.toFixed(3) + ')'; c.lineWidth = 0.07;
    c.beginPath(); c.ellipse(0, 0, G.TX - 0.08, G.TY - 0.07, 0, 1.12 * Math.PI, 1.72 * Math.PI); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.40)'; c.lineWidth = 0.05;
    c.beginPath(); c.ellipse(0, 0, G.TX - 0.05, G.TY - 0.04, 0, 0.30 * Math.PI, 0.70 * Math.PI); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.30)'; c.lineWidth = 0.035;
    c.beginPath(); c.ellipse(0, G.OC + 0.02, G.OX + 0.10, G.OY + 0.085, 0, 0.22 * Math.PI, 0.78 * Math.PI); c.stroke();
    // קו מתאר דק של הקצה החיצוני – קריאות על רקעים בהירים
    c.strokeStyle = 'rgba(40,45,52,0.45)'; c.lineWidth = 0.03;
    c.beginPath(); c.ellipse(0, G.SIDE, G.TX, G.TY, 0, 0, Math.PI); c.stroke();
    c.restore();
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pits;
  else root.Pits = Pits;
})(this);
