/* Emojiverse (לשעבר כובש) – דמויות מופשטות מקוריות (צורה רכה + שתי עיניים), מצוירות בקוד.
   הצורה נשמרת פעם אחת בקנבס צדדי לכל דמות/צבע/גודל; העיניים מצוירות בכל פריים (זול)
   ומוזזות לאורך וקטור הכיוון, והצורה נמתחת/נוטה מעט לכיוון התנועה. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  var AVATARS = [
    { name: 'נובה', shape: 'orb',      color: '#b8a2d9', eyes: 'dot'  },
    { name: 'קאי',  shape: 'squircle', color: '#7f9cc9', eyes: 'pill' },
    { name: 'לונה', shape: 'drop',     color: '#e3a1b4', eyes: 'ring' },
    { name: 'ריו',  shape: 'tri',      color: '#ecae8f', eyes: 'dot'  },
    { name: 'מיקה', shape: 'blob',     color: '#93d3b4', eyes: 'glow' },
    { name: 'זיו',  shape: 'pill',     color: '#e3c98f', eyes: 'pill' },
    { name: 'טל',   shape: 'hex',      color: '#b0c48f', eyes: 'ring' },
    { name: 'אורי', shape: 'flower',   color: '#78c2c8', eyes: 'glow' }
  ];
  // צורות שמסתובבות עם כיוון התנועה (יש להן "חזית")
  var ROTATES = { drop: 1, tri: 1, pill: 1 };

  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function darker(h, t) { var c = hex2rgb(h), s = [46, 52, 64];
    return 'rgb(' + Math.round(c[0] + (s[0] - c[0]) * t) + ',' + Math.round(c[1] + (s[1] - c[1]) * t) + ',' + Math.round(c[2] + (s[2] - c[2]) * t) + ')'; }
  function tone(h, t) { // t>0 בהיר יותר, t<0 כהה יותר
    var c = hex2rgb(h), m = t > 0 ? 255 : 0, a = Math.abs(t);
    return 'rgb(' + Math.round(c[0] + (m - c[0]) * a) + ',' + Math.round(c[1] + (m - c[1]) * a) + ',' + Math.round(c[2] + (m - c[2]) * a) + ')';
  }

  // מסלול הצורה סביב (0,0) ברדיוס r, "חזית" לכיוון +x
  function shapePath(ctx, shape, r) {
    ctx.beginPath();
    var i, a, n = 64;
    if (shape === 'orb') { ctx.arc(0, 0, r, 0, TAU); return; }
    if (shape === 'squircle') {
      for (i = 0; i <= n; i++) { a = i / n * TAU; var c = Math.cos(a), s = Math.sin(a);
        var x = Math.sign(c) * Math.pow(Math.abs(c), 0.5) * r * 0.92, y = Math.sign(s) * Math.pow(Math.abs(s), 0.5) * r * 0.92;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); return;
    }
    if (shape === 'drop') { // טיפה: קצה מחודד מאחור (-x)
      ctx.moveTo(-r * 1.25, 0);
      ctx.bezierCurveTo(-r * 0.6, -r * 0.55, -r * 0.2, -r * 0.95, r * 0.25, -r * 0.92);
      ctx.arc(0.1 * r, 0, r * 0.93, -1.42, 1.42);
      ctx.bezierCurveTo(-r * 0.2, r * 0.95, -r * 0.6, r * 0.55, -r * 1.25, 0);
      ctx.closePath(); return;
    }
    if (shape === 'tri') { ctx.translate(-r * 0.12, 0); roundPoly(ctx, 3, r * 1.32, 0, r * 0.38); ctx.translate(r * 0.12, 0); return; }
    if (shape === 'hex') { roundPoly(ctx, 6, r * 1.02, Math.PI / 6, r * 0.3); return; }
    if (shape === 'pill') { // קפסולה לאורך כיוון התנועה
      var w = r * 0.42, hh = r * 0.8;
      ctx.moveTo(-w, -hh); ctx.lineTo(w, -hh); ctx.arc(w, 0, hh, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-w, hh); ctx.arc(-w, 0, hh, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath(); return;
    }
    var k = shape === 'flower' ? [0.1, 5, 0, 0] : [0.07, 3, 0.05, 5]; // flower / blob
    for (i = 0; i <= n; i++) { a = i / n * TAU;
      var rr = r * (0.94 + k[0] * Math.cos(k[1] * a) + k[2] * Math.sin(k[3] * a + 1));
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
  }
  function roundPoly(ctx, sides, R, rot, rad) {
    var pts = [];
    for (var i = 0; i < sides; i++) { var a = rot + i / sides * TAU; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
    var m0 = mid(pts[sides - 1], pts[0]); ctx.moveTo(m0[0], m0[1]);
    for (i = 0; i < sides; i++) { var p = pts[i], q = pts[(i + 1) % sides], m = mid(p, q); ctx.arcTo(p[0], p[1], m[0], m[1], rad); }
    ctx.closePath();
  }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  var cache = {};
  /* קנבס בסיס (בלי עיניים). גודל הקנבס = 2*size כדי לפנות מקום להילה */
  function base(index, size, color) {
    var a = AVATARS[index % AVATARS.length]; color = color || a.color;
    var key = index + '|' + size + '|' + color, cv = cache[key];
    if (cv) return cv;
    cv = document.createElement('canvas'); var S = cv.width = cv.height = Math.ceil(size * 2);
    var ctx = cv.getContext('2d'), r = size / 2;
    ctx.translate(S / 2, S / 2);
    // צבע אחיד ושטוח (בלי גרדיאנט ובלי הילה)
    ctx.fillStyle = color; shapePath(ctx, a.shape, r); ctx.fill();
    // קו מתאר דק בגוון כהה יותר של אותו צבע – כדי שהדמות תבלוט גם על השטח שלה
    ctx.lineWidth = Math.max(1.5, size * 0.055); ctx.lineJoin = 'round';
    ctx.strokeStyle = darker(color, 0.42); ctx.stroke();
    cache[key] = cv;
    return cv;
  }

  /* מצייר דמות מלאה במרכז (x,y). heading ברדיאנים; look = עוצמת המבט (0..1); blink = 0..1 */
  function draw(ctx, index, color, x, y, size, heading, look, blink) {
    var a = AVATARS[index % AVATARS.length], cv = base(index, size, color), S = cv.width, r = size / 2;
    if (look == null) look = 1;
    var hx = Math.cos(heading), hy = Math.sin(heading);
    // צל שטוח ורך מתחת לדמות (לא מסתובב)
    ctx.fillStyle = 'rgba(46,52,64,0.12)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 1.02, r * 0.75, r * 0.17, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y);
    // מתיחה קלה לכיוון התנועה
    ctx.rotate(heading); ctx.scale(1 + 0.07 * look, 1 - 0.05 * look);
    if (!ROTATES[a.shape]) ctx.rotate(-heading);
    ctx.drawImage(cv, -S / 2, -S / 2);
    ctx.restore();
    // עיניים: תמיד אופקיות (פונות לצופה), מוזזות לאורך הכיוון
    var fx = x + hx * r * 0.3 * look, fy = y + hy * r * 0.26 * look - r * 0.06;
    var sep = r * 0.36 * (1 - 0.18 * Math.abs(hx) * look);
    var px = hx * r * 0.07 * look, py = hy * r * 0.07 * look;
    var open = 1 - (blink || 0);
    for (var s = -1; s <= 1; s += 2) {
      // העין בצד שאליו פונים מעט גדולה יותר
      var ex = fx + s * sep, k = 1 + s * hx * 0.1 * look;
      eye(ctx, a.eyes, ex, fy, r * k, px, py, open);
    }
  }
  function eye(ctx, style, x, y, r, px, py, open) {
    var h = Math.max(0.12, open);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, h);
    if (style === 'dot') {
      ctx.fillStyle = '#1b1838'; circle(ctx, px, py, r * 0.17); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, px - r * 0.05, py - r * 0.06, r * 0.055); ctx.fill();
    } else if (style === 'pill') {
      ctx.fillStyle = '#fff'; capsule(ctx, px, py, r * 0.1, r * 0.2); ctx.fill();
    } else if (style === 'ring') {
      ctx.fillStyle = '#fff'; circle(ctx, 0, 0, r * 0.2); ctx.fill();
      ctx.fillStyle = '#1b1838'; circle(ctx, px * 1.3, py * 1.3, r * 0.1); ctx.fill();
    } else { // glow
      ctx.shadowColor = '#fff'; ctx.shadowBlur = r * 0.35;
      ctx.fillStyle = '#fff'; circle(ctx, px, py, r * 0.15); ctx.fill();
    }
    ctx.restore();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function capsule(ctx, x, y, w, h) { ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); }

  /* תמונה סטטית (לתפריט, לטבלה ולמסך הסיום): מבט קדימה-מטה */
  function dataURL(index, size, color) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    draw(cv.getContext('2d'), index, color, size / 2, size / 2, size * 0.62, Math.PI / 2, 0.45, 0);
    return cv.toDataURL();
  }
  function clear() { cache = {}; }

  root.Avatars = { list: AVATARS, base: base, draw: draw, dataURL: dataURL, clear: clear };
})(this);
