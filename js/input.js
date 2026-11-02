/* Emojiverse (לשעבר כובש) – מיפוי קלט מגע/עכבר לזווית (טהור, נבדק ב-node). נכתב מאפס.
   שלושה מצבים:
   point (ברירת מחדל) – "הצבעה": הכיוון הרצוי הוא מהדמות (מרכז המסך, המצלמה עוקבת אחריה) אל האצבע/העכבר.
                       נגיעה אחת מכוונת מיד; הרמת האצבע משאירה את הכיוון האחרון.
   drag  – גרירה יחסית: מהעוגן (נקודת הנגיעה) אל האצבע; העוגן נגרר אחרי האצבע במרחק leash.
   joy   – ג'ויסטיק צף ברדיוס 50px.
   dead = אזור מת בפיקסלי CSS (ב-point: סביב הדמות). smooth = החלקה מעגלית (1 = בלי החלקה). */
(function (root) {
  'use strict';
  var SENS = {
    low:    { dead: 12, leash: 80, smooth: 0.55, pDead: 26, pSmooth: 0.5 },
    medium: { dead: 8,  leash: 60, smooth: 0.8,  pDead: 14, pSmooth: 0.85 },
    high:   { dead: 5,  leash: 42, smooth: 1.0,  pDead: 6,  pSmooth: 1.0 }
  };
  function DragInput(sens, mode) { this.set(sens, mode); this.active = false; this.angle = null; this.cx = 0; this.cy = 0; this.kx = 0; this.ky = 0; }
  DragInput.SENS = SENS;
  DragInput.prototype.set = function (sens, mode) { this.cfg = SENS[sens] || SENS.medium; this.mode = mode || 'point'; };
  /* מיקום הדמות על המסך (פיקסלי CSS) – נדרש למצב point */
  DragInput.prototype.setCenter = function (x, y) { this.cx = x; this.cy = y; };
  /* ב-point מחזיר זווית כבר בנגיעה; בשאר המצבים null */
  DragInput.prototype.down = function (x, y) {
    this.active = true; this.ax = x; this.ay = y; this.angle = null; this.kx = 0; this.ky = 0;
    return this.mode === 'point' ? this.aim(x, y) : null;
  };
  /* הצבעה: לא דורש נגיעה פעילה (עכבר בריחוף) */
  DragInput.prototype.aim = function (x, y) {
    var dx = x - this.cx, dy = y - this.cy;
    if (dx * dx + dy * dy < this.cfg.pDead * this.cfg.pDead) return null;
    return this._smooth(Math.atan2(dy, dx), this.cfg.pSmooth);
  };
  /* מחזיר זווית (רדיאנים) או null אם עדיין באזור המת */
  DragInput.prototype.move = function (x, y) {
    if (!this.active) return null;
    if (this.mode === 'point') return this.aim(x, y);
    var dx = x - this.ax, dy = y - this.ay, d = Math.hypot(dx, dy), c = this.cfg;
    if (this.mode === 'joy') {
      var R = 50, k = d > R ? R / d : 1; this.kx = dx * k; this.ky = dy * k;
      if (d < c.dead) return null;
      return this._smooth(Math.atan2(dy, dx), c.smooth);
    }
    if (d < c.dead) return null;
    var a = Math.atan2(dy, dx);
    if (d > c.leash) { this.ax = x - dx / d * c.leash; this.ay = y - dy / d * c.leash; }
    return this._smooth(a, c.smooth);
  };
  DragInput.prototype._smooth = function (a, s) {
    if (this.angle == null || s >= 1) return (this.angle = a);
    var d = Math.atan2(Math.sin(a - this.angle), Math.cos(a - this.angle));
    this.angle = this.angle + d * s;
    return this.angle;
  };
  DragInput.prototype.up = function () { this.active = false; };

  if (typeof module !== 'undefined' && module.exports) module.exports = DragInput;
  else root.DragInput = DragInput;
})(this);
