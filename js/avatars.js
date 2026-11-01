/* כובש – דמויות מקוריות מצוירות בקוד (Canvas). אין כאן שום נכס חיצוני.
   כל דמות מצוירת פעם אחת לכל כיוון (4 גרסאות) לקנבס צדדי, ואז רק "מודבקת". */
(function (root) {
  'use strict';

  // הגדרות הדמויות: עור, שיער, סגנון שיער, צבע עיניים, תוספת
  var AVATARS = [
    { name: 'נובה', skin: '#ffd9c0', hair: '#ff5fa2', hair2: '#d93a7f', style: 'twinbuns', eyes: '#7b3fe4', extra: 'blush' },
    { name: 'קאי',  skin: '#f1c7a5', hair: '#2b2f4a', hair2: '#151829', style: 'spiky',    eyes: '#2aa7ff', extra: 'none' },
    { name: 'לונה', skin: '#ffe3d1', hair: '#c9d4ff', hair2: '#8e9ce6', style: 'long',     eyes: '#3fb8a8', extra: 'star' },
    { name: 'ריו',  skin: '#d9a07a', hair: '#ff8a1f', hair2: '#d0610a', style: 'sweep',    eyes: '#5b3a1a', extra: 'none' },
    { name: 'מיקה', skin: '#ffd6b8', hair: '#3a2418', hair2: '#24150d', style: 'bob',      eyes: '#e2483b', extra: 'glasses' },
    { name: 'זיו',  skin: '#c98b62', hair: '#1bbf8a', hair2: '#0f8a62', style: 'curly',    eyes: '#ffb400', extra: 'none' },
    { name: 'טל',   skin: '#ffe0c7', hair: '#ffd23f', hair2: '#e0a800', style: 'ponytail', eyes: '#2f6fe0', extra: 'blush' },
    { name: 'אורי', skin: '#f3c9a8', hair: '#5a5fff', hair2: '#3a3fd0', style: 'hood',     eyes: '#ff4fd8', extra: 'none' }
  ];

  // כיוון: 0 ימין, 1 למטה, 2 שמאל, 3 למעלה
  var LOOK = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
  }

  function draw(ctx, S, a, dir, ringColor) {
    var c = S / 2, r = S * 0.34;
    var lk = dir == null ? [0, 0.25] : LOOK[dir];
    var fx = lk[0] * r * 0.16, fy = lk[1] * r * 0.12;       // תזוזת תווי פנים
    var ex = lk[0] * r * 0.11, ey = lk[1] * r * 0.10;       // תזוזת אישונים נוספת
    var tilt = lk[0] * 0.13;
    ctx.save();
    ctx.clearRect(0, 0, S, S);

    // טבעת בצבע השחקן
    if (ringColor) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(ctx, c, c + S * 0.03, S * 0.47, S * 0.47); ctx.fill();
      ctx.fillStyle = ringColor; ellipse(ctx, c, c, S * 0.47, S * 0.47); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ellipse(ctx, c, c, S * 0.43, S * 0.43); ctx.fill();
    }

    ctx.translate(c, c + S * 0.03); ctx.rotate(tilt); ctx.translate(-c, -(c + S * 0.03));

    // שיער אחורי
    ctx.fillStyle = a.hair2;
    if (a.style === 'long') {
      ctx.beginPath();
      ctx.moveTo(c - r * 1.12, c - r * 0.2);
      ctx.quadraticCurveTo(c - r * 1.25, c + r * 1.1, c - r * 0.7, c + r * 1.25);
      ctx.lineTo(c + r * 0.7, c + r * 1.25);
      ctx.quadraticCurveTo(c + r * 1.25, c + r * 1.1, c + r * 1.12, c - r * 0.2);
      ctx.closePath(); ctx.fill();
    } else if (a.style === 'bob') {
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(c - r * 1.15, c - r * 0.9, r * 2.3, r * 1.85, r * 0.6) : ctx.rect(c - r * 1.15, c - r * 0.9, r * 2.3, r * 1.85); ctx.fill();
    } else if (a.style === 'ponytail') {
      ellipse(ctx, c - lk[0] * r * 0.9 + r * (lk[0] ? 0 : 1.05), c + r * 0.15 - lk[1] * r * 0.3, r * 0.42, r * 0.75, 0.5); ctx.fill();
    } else if (a.style === 'twinbuns') {
      ellipse(ctx, c - r * 0.85, c - r * 0.85, r * 0.42, r * 0.42); ctx.fill();
      ellipse(ctx, c + r * 0.85, c - r * 0.85, r * 0.42, r * 0.42); ctx.fill();
    } else if (a.style === 'hood') {
      ctx.fillStyle = a.hair;
      ellipse(ctx, c, c + r * 0.05, r * 1.22, r * 1.2); ctx.fill();
      // אוזני חתול על הכובע
      ctx.beginPath(); ctx.moveTo(c - r * 1.05, c - r * 0.5); ctx.lineTo(c - r * 0.95, c - r * 1.45); ctx.lineTo(c - r * 0.35, c - r * 1.0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c + r * 1.05, c - r * 0.5); ctx.lineTo(c + r * 0.95, c - r * 1.45); ctx.lineTo(c + r * 0.35, c - r * 1.0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb3d9';
      ctx.beginPath(); ctx.moveTo(c - r * 0.92, c - r * 0.75); ctx.lineTo(c - r * 0.9, c - r * 1.2); ctx.lineTo(c - r * 0.55, c - r * 0.95); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c + r * 0.92, c - r * 0.75); ctx.lineTo(c + r * 0.9, c - r * 1.2); ctx.lineTo(c + r * 0.55, c - r * 0.95); ctx.closePath(); ctx.fill();
    }

    // פנים
    var g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.4, r * 0.2, c, c, r * 1.1);
    g.addColorStop(0, a.skin); g.addColorStop(1, shade(a.skin, -18));
    ctx.fillStyle = g; ellipse(ctx, c + fx * 0.25, c + fy * 0.2, r * 0.98, r * 1.0); ctx.fill();

    // עיניים
    var eyeY = c + r * 0.12 + fy, eyeDX = r * 0.4, eW = r * 0.24, eH = r * 0.32;
    for (var s = -1; s <= 1; s += 2) {
      var x = c + s * eyeDX + fx;
      // הצד שאליו מסתכלים מעט גדול יותר (פרספקטיבה)
      var k = 1 + s * lk[0] * 0.1;
      ctx.fillStyle = '#fff'; ellipse(ctx, x, eyeY, eW * k, eH * k); ctx.fill();
      ctx.save(); ellipse(ctx, x, eyeY, eW * k, eH * k); ctx.clip();
      var ix = x + ex, iy = eyeY + ey;
      ctx.fillStyle = a.eyes; ellipse(ctx, ix, iy, eW * 0.78 * k, eH * 0.8 * k); ctx.fill();
      ctx.fillStyle = shade(a.eyes, -45); ellipse(ctx, ix, iy + eH * 0.1, eW * 0.42 * k, eH * 0.46 * k); ctx.fill();
      ctx.fillStyle = '#fff'; ellipse(ctx, ix - eW * 0.28, iy - eH * 0.32, eW * 0.24, eH * 0.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ellipse(ctx, ix + eW * 0.25, iy + eH * 0.3, eW * 0.12, eH * 0.1); ctx.fill();
      ctx.restore();
      // ריסים עליונים
      ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = Math.max(1, S * 0.022); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(x, eyeY, eW * k * 1.02, eH * k * 1.02, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      // גבות
      ctx.strokeStyle = a.hair2; ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.beginPath(); ctx.moveTo(x - eW * 0.8, eyeY - eH * 1.45 + fy * 0.3); ctx.quadraticCurveTo(x, eyeY - eH * 1.75 + fy * 0.3, x + eW * 0.8, eyeY - eH * 1.45 + fy * 0.3); ctx.stroke();
    }
    // סומק
    if (a.extra === 'blush') {
      ctx.fillStyle = 'rgba(255,110,140,0.35)';
      ellipse(ctx, c - r * 0.62 + fx, c + r * 0.5 + fy, r * 0.17, r * 0.09); ctx.fill();
      ellipse(ctx, c + r * 0.62 + fx, c + r * 0.5 + fy, r * 0.17, r * 0.09); ctx.fill();
    }
    // פה
    ctx.strokeStyle = '#8a3b3b'; ctx.lineWidth = Math.max(1, S * 0.022);
    ctx.beginPath(); ctx.arc(c + fx * 1.1, c + r * 0.55 + fy, r * 0.15, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // משקפיים
    if (a.extra === 'glasses') {
      ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, S * 0.025);
      for (var t = -1; t <= 1; t += 2) { ellipse(ctx, c + t * eyeDX + fx, eyeY, eW * 1.45, eH * 1.2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(c - eyeDX + eW * 1.45 + fx, eyeY); ctx.lineTo(c + eyeDX - eW * 1.45 + fx, eyeY); ctx.stroke();
    }

    // שיער קדמי (פוני) – זז מעט עם המבט
    var hx = fx * 0.5, hy = fy * 0.25;
    ctx.fillStyle = a.hair;
    if (a.style === 'spiky') {
      ctx.beginPath(); ctx.moveTo(c - r * 1.05 + hx, c - r * 0.05 + hy);
      var spikes = 6;
      for (var i = 0; i <= spikes; i++) {
        var px = c - r * 1.05 + (2.1 * r) * i / spikes + hx;
        var py = c - r * (i % 2 ? 1.45 : 0.75) - (i === 3 ? r * 0.2 : 0) + hy;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(c + r * 1.05 + hx, c - r * 0.05 + hy);
      ctx.quadraticCurveTo(c + r * 0.4 + hx, c - r * 0.55 + hy, c + hx, c - r * 0.5 + hy);
      ctx.quadraticCurveTo(c - r * 0.4 + hx, c - r * 0.55 + hy, c - r * 1.05 + hx, c - r * 0.05 + hy);
      ctx.fill();
    } else if (a.style === 'curly') {
      for (var j = 0; j < 9; j++) {
        var ang = Math.PI * (1.0 + j / 8);
        ellipse(ctx, c + Math.cos(ang) * r * 0.95 + hx, c - r * 0.1 + Math.sin(ang) * r * 0.95 + hy, r * 0.32, r * 0.32); ctx.fill();
      }
      ellipse(ctx, c + hx, c - r * 0.75 + hy, r * 0.75, r * 0.4); ctx.fill();
    } else if (a.style === 'sweep') {
      ctx.beginPath(); ctx.moveTo(c - r * 1.05 + hx, c + r * 0.1 + hy);
      ctx.quadraticCurveTo(c - r * 1.1 + hx, c - r * 1.25 + hy, c + hx, c - r * 1.15 + hy);
      ctx.quadraticCurveTo(c + r * 1.2 + hx, c - r * 1.1 + hy, c + r * 1.05 + hx, c + r * 0.2 + hy);
      ctx.quadraticCurveTo(c + r * 0.6 + hx, c - r * 0.5 + hy, c - r * 0.4 + hx, c - r * 0.25 + hy);
      ctx.quadraticCurveTo(c - r * 0.8 + hx, c - r * 0.1 + hy, c - r * 1.05 + hx, c + r * 0.1 + hy);
      ctx.fill();
    } else if (a.style === 'hood') {
      ctx.fillStyle = a.hair2;
      ctx.beginPath(); ctx.moveTo(c - r * 0.95 + hx, c - r * 0.1 + hy);
      ctx.quadraticCurveTo(c + hx, c - r * 1.2 + hy, c + r * 0.95 + hx, c - r * 0.1 + hy);
      ctx.quadraticCurveTo(c + r * 0.3 + hx, c - r * 0.5 + hy, c - r * 0.1 + hx, c - r * 0.35 + hy);
      ctx.quadraticCurveTo(c - r * 0.5 + hx, c - r * 0.45 + hy, c - r * 0.95 + hx, c - r * 0.1 + hy);
      ctx.fill();
    } else {
      // פוני מעוגל עם שפיצים (bob / long / ponytail / twinbuns)
      ctx.beginPath(); ctx.moveTo(c - r * 1.08 + hx, c + r * (a.style === 'bob' || a.style === 'long' ? 0.6 : 0.05) + hy);
      ctx.quadraticCurveTo(c - r * 1.15 + hx, c - r * 1.25 + hy, c + hx, c - r * 1.18 + hy);
      ctx.quadraticCurveTo(c + r * 1.15 + hx, c - r * 1.25 + hy, c + r * 1.08 + hx, c + r * (a.style === 'bob' || a.style === 'long' ? 0.6 : 0.05) + hy);
      ctx.lineTo(c + r * 0.85 + hx, c - r * 0.2 + hy);
      ctx.lineTo(c + r * 0.55 + hx, c - r * 0.45 + hy);
      ctx.lineTo(c + r * 0.3 + hx, c - r * 0.2 + hy);
      ctx.lineTo(c + r * 0.0 + hx, c - r * 0.5 + hy);
      ctx.lineTo(c - r * 0.3 + hx, c - r * 0.22 + hy);
      ctx.lineTo(c - r * 0.6 + hx, c - r * 0.48 + hy);
      ctx.lineTo(c - r * 0.85 + hx, c - r * 0.2 + hy);
      ctx.closePath(); ctx.fill();
    }
    // ברק בשיער
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1, S * 0.025);
    ctx.beginPath(); ctx.arc(c - r * 0.2 + hx, c - r * 0.55 + hy, r * 0.5, 1.15 * Math.PI, 1.45 * Math.PI); ctx.stroke();
    // סיכת כוכב
    if (a.extra === 'star') star(ctx, c + r * 0.75 + hx, c - r * 0.75 + hy, r * 0.22, '#ffd84a');
    ctx.restore();
  }

  function star(ctx, x, y, R, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? R * 0.45 : R, a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var cache = {};
  /* מחזיר קנבס מוכן לדמות בכיוון נתון (dir=null => מבט קדמי) */
  function get(index, dir, size, ringColor) {
    var key = index + '|' + dir + '|' + size + '|' + ringColor;
    var cv = cache[key];
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = size;
      draw(cv.getContext('2d'), size, AVATARS[index % AVATARS.length], dir, ringColor);
      cache[key] = cv;
    }
    return cv;
  }
  function dataURL(index, size, ringColor) { return get(index, null, size, ringColor).toDataURL(); }
  function clear() { cache = {}; }

  root.Avatars = { list: AVATARS, get: get, dataURL: dataURL, clear: clear, draw: draw };
})(this);
