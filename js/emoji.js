/* Emojiverse (לשעבר כובש) – דמויות אימוג'י. האימוג'י מצויר בגופן האימוג'י של המערכת (בסמסונג – של סמסונג),
   פעם אחת לכל גודל לתוך קנבס צדדי (sprite), ואז רק מעתיקים אותו – בלי fillText בכל פריים.
   סביב האימוג'י: עיגול בצבע השחקן + קו מתאר, ו"חץ" קטן בצבע השחקן שמראה את כיוון התנועה. */
(function (root) {
  'use strict';
  var LIST = ['😎', '🦊', '🐸', '🐱', '🐶', '🦁', '🐵', '🐼', '🐧', '🦄', '🐲', '🐙', '🐝', '🦖', '🐯', '🐰', '🐨', '🐷',
    '🐢', '🦉', '🐳', '🦋', '👻', '🤖', '👽', '🤠', '🥳', '🤩', '😺', '🍕', '🍔', '🍩', '🍉', '🍓', '⚽', '🏀', '🚀', '⭐', '🔥', '🌈'];
  var RANDOM = '';                       // ריק = "🎲 אקראי"
  var FONT = '"Samsung Color Emoji","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  var cache = {};

  function valid(e) { return LIST.indexOf(e) >= 0; }
  /* אימוג'י אקראי שלא בשימוש (אם הכול תפוס – כל אחד) */
  function randomFree(used, rand) {
    rand = rand || Math.random;
    var free = LIST.filter(function (e) { return !used || used.indexOf(e) < 0; });
    var pool = free.length ? free : LIST;
    return pool[Math.floor(rand() * pool.length)];
  }
  /* האימוג'י לבד, פעם אחת לכל גודל */
  function glyph(e, px) {
    var k = e + '|' + px;
    if (cache[k]) return cache[k];
    var c = document.createElement('canvas'), s = Math.ceil(px * 1.25);
    c.width = c.height = s;
    var x = c.getContext('2d');
    x.font = px + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(e, s / 2, s / 2 + px * 0.06);
    return (cache[k] = c);
  }
  /* דמות שלמה (עיגול בצבע + אימוג'י) – לממשק ולמשחק */
  function badge(e, size, color, outline) {
    var k = 'b' + e + '|' + size + '|' + color + '|' + outline;
    if (cache[k]) return cache[k];
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), r = size / 2;
    x.fillStyle = color; x.beginPath(); x.arc(r, r, r * 0.92, 0, Math.PI * 2); x.fill();
    x.lineWidth = Math.max(1.5, size * 0.07); x.strokeStyle = outline || 'rgba(46,52,64,.45)'; x.beginPath(); x.arc(r, r, r * 0.92 - x.lineWidth / 2, 0, Math.PI * 2); x.stroke();
    var g = glyph(e, Math.round(size * 0.52));   // v9: אימוג'י קטן ב-~16% בתוך אותו עיגול
    x.drawImage(g, r - g.width / 2, r - g.height / 2);
    return (cache[k] = c);
  }
  /* ציור במשחק: צל שטוח, חץ כיוון, עיגול+אימוג'י (מוטה קלות לכיוון התנועה) */
  function draw(ctx, e, color, outline, x, y, size, heading) {
    var r = size / 2, b = badge(e, size, color, outline);
    ctx.fillStyle = 'rgba(46,52,64,.16)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    // v9: "זיז" כיוון קטן – משולש מלא בצבע השחקן, צמוד לשפת העיגול (בלי חץ). heading=null => בלי זיז (אפקטים)
    var c = 1, s = 0;
    if (heading != null) {
      c = Math.cos(heading); s = Math.sin(heading);
      var tip = r * 1.2, base = r * 0.86, w = r * 0.22;
      ctx.fillStyle = color; ctx.strokeStyle = outline || color; ctx.lineWidth = Math.max(1, r * 0.06); ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + c * tip, y + s * tip);
      ctx.lineTo(x + c * base - s * w, y + s * base + c * w);
      ctx.lineTo(x + c * base + s * w, y + s * base - c * w);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // הטיה עדינה (עד ~13°): נוטה למעלה/למטה לפי התנועה, בלי להפוך את האימוג'י
    var tilt = Math.atan2(s, Math.abs(c) + 1e-6) * 0.15 * (c >= 0 ? 1 : -1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.drawImage(b, -r, -r, size, size);
    ctx.restore();
  }
  function dataURL(e, size, color, outline) { return badge(e || '🎲', size, color || '#e5e9f0', outline).toDataURL(); }
  function clear() { cache = {}; }

  var Emoji = { LIST: LIST, RANDOM: RANDOM, valid: valid, randomFree: randomFree, draw: draw, dataURL: dataURL, badge: badge, glyph: glyph, clear: clear };
  if (typeof module !== 'undefined' && module.exports) module.exports = Emoji;
  else root.Emoji = Emoji;
})(this);
