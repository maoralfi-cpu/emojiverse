/* כובש – מיפוי קלט מגע לזווית (טהור, נבדק ב-node).
   מצב "גרירה יחסית": הזווית היא מהעוגן (נקודת הנגיעה) אל האצבע. כשהאצבע מתרחקת יותר מ-leash,
   העוגן נגרר אחריה במרחק הזה (כמו ג'ויסטיק צף), כך שתמיד אפשר לשנות כיוון מיד.
   dead = אזור מת קטן כדי שנגיעה קלה לא תזיז. קואורדינטות CSS של המסך; y למטה = y למטה בעולם. */
(function (root) {
  'use strict';
  var SENS = {
    low:    { dead: 12, leash: 80, smooth: 0.55 },
    medium: { dead: 8,  leash: 60, smooth: 0.8 },
    high:   { dead: 5,  leash: 42, smooth: 1.0 }
  };
  function DragInput(sens, mode) { this.set(sens, mode); this.active = false; this.angle = null; }
  DragInput.SENS = SENS;
  DragInput.prototype.set = function (sens, mode) { this.cfg = SENS[sens] || SENS.medium; this.mode = mode || 'drag'; };
  DragInput.prototype.down = function (x, y) { this.active = true; this.ax = x; this.ay = y; this.angle = null; this.kx = 0; this.ky = 0; };
  /* מחזיר זווית (רדיאנים) או null אם עדיין באזור המת */
  DragInput.prototype.move = function (x, y) {
    if (!this.active) return null;
    var dx = x - this.ax, dy = y - this.ay, d = Math.hypot(dx, dy), c = this.cfg;
    if (this.mode === 'joy') { // ג'ויסטיק: הבסיס קבוע, הידית מוגבלת לרדיוס
      var R = 50, k = d > R ? R / d : 1; this.kx = dx * k; this.ky = dy * k;
      if (d < c.dead) return null;
      return this._smooth(Math.atan2(dy, dx));
    }
    if (d < c.dead) return null;
    var a = Math.atan2(dy, dx);
    if (d > c.leash) { this.ax = x - dx / d * c.leash; this.ay = y - dy / d * c.leash; }
    return this._smooth(a);
  };
  // החלקה קלה נגד רעידות (מעגלית, כדי שלא תהיה קפיצה במעבר ±π)
  DragInput.prototype._smooth = function (a) {
    if (this.angle == null || this.cfg.smooth >= 1) return (this.angle = a);
    var d = Math.atan2(Math.sin(a - this.angle), Math.cos(a - this.angle));
    this.angle = this.angle + d * this.cfg.smooth;
    return this.angle;
  };
  DragInput.prototype.up = function () { this.active = false; };

  if (typeof module !== 'undefined' && module.exports) module.exports = DragInput;
  else root.DragInput = DragInput;
})(this);
