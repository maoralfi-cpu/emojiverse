/* Emojiverse – אפקטים חזותיים (v9). נכתב מאפס.
   - מערכת חלקיקים במאגר קבוע (מערכים מוקלדים, תקרה קשיחה), בלי הקצאות בכל פריים.
   - "אפקטים מיוחדים" (טבעות, אימוג'י מסתובב, טקסט צף, גל צבע) – מאגר קבוע של אובייקטים.
   - הכול בקואורדינטות עולם עם מיקום עטוף (העותק הקרוב למצלמה), מדולג מחוץ למסך, מוגבל בזמן (≤1 שנ').
   - לא מכסה את המסך: אין הבזק מסך מלא; גל הכיבוש שקוף ותחום לאזור שנכבש. */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  var CAP = { full: 300, reduced: 110, off: 0 };
  var N = 300;
  var px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  var life = new Float32Array(N), maxl = new Float32Array(N), sz = new Float32Array(N), ang = new Float32Array(N), av = new Float32Array(N), len = new Float32Array(N);
  var kind = new Uint8Array(N), col = new Array(N), n = 0;
  var SP = 40, sp = [];
  for (var i = 0; i < SP; i++) sp.push({ on: false, type: '', x: 0, y: 0, t0: 0, dur: 0, col: '', col2: '', emoji: '', outline: '', r: 0, a: 0, b: 0, c: 0, d: 0, text: '' });

  var FX = { level: 'full', stats: { spawned: 0, dropped: 0, specials: 0 } };
  FX.cap = function () { return CAP[FX.level] || 0; };
  FX.count = function () { return n; };
  FX.activeSpecials = function () { var c = 0; for (var i = 0; i < SP; i++) if (sp[i].on) c++; return c; };
  FX.clear = function () { n = 0; for (var i = 0; i < SP; i++) sp[i].on = false; };

  /* חלקיק: kind 0 = נקודה, 1 = מקטע (שבר של שובל), 2 = כוכב */
  function part(x, y, vxx, vyy, l, s, c, k, a, w, ln) {
    if (n >= FX.cap()) { FX.stats.dropped++; return false; }
    px[n] = x; py[n] = y; vx[n] = vxx; vy[n] = vyy; life[n] = l; maxl[n] = l; sz[n] = s; col[n] = c; kind[n] = k || 0; ang[n] = a || 0; av[n] = w || 0; len[n] = ln || 0;
    n++; FX.stats.spawned++; return true;
  }
  FX.particle = part;
  function burst(x, y, count, speed, c, s, l, k) {
    if (FX.level === 'reduced') count = Math.ceil(count * 0.4);
    for (var i = 0; i < count; i++) { var a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.8); part(x, y, Math.cos(a) * v, Math.sin(a) * v, l * (0.7 + Math.random() * 0.5), s, c, k, a, (Math.random() - 0.5) * 8, 0); }
  }
  function special(type, x, y, dur, now) {
    var best = null, oldest = Infinity;
    for (var i = 0; i < SP; i++) { if (!sp[i].on) { best = sp[i]; break; } if (sp[i].t0 < oldest) { oldest = sp[i].t0; best = sp[i]; } }
    best.on = true; best.type = type; best.x = x; best.y = y; best.t0 = now; best.dur = FX.level === 'reduced' ? dur * 0.75 : dur;
    best.col = ''; best.col2 = ''; best.emoji = ''; best.outline = ''; best.r = 0; best.a = best.b = best.c = best.d = 0; best.text = '';
    FX.stats.specials++;
    return best;
  }

  /* איזה אפקט לכל סוג פסילה (נבדק ב-node) */
  var PLAN = {
    trail: ['snap', 'slash', 'pop'],
    pit: ['implode', 'burst'],
    enclosed: ['pulse', 'cage', 'implode', 'burst'],
    head: ['shock', 'knock', 'stars'],
    self: ['wobble', 'dizzy'],
    territory: ['dissolve', 'fadeGrey'],
    left: ['fade']
  };
  FX.plan = function (reason) { return PLAN[reason] || ['fade']; };

  /* d: { reason, x, y, color, emoji, outline, trail(שטוח, פרוש), killer:{x,y,color}, mine, byMe } */
  FX.death = function (d, now) {
    var plan = FX.plan(d.reason);
    if (FX.level === 'off') return plan;
    var s, i, k;
    for (var p = 0; p < plan.length; p++) switch (plan[p]) {
      case 'snap': // השובל "נשבר" לרסיסים
        var t = d.trail || [], segs = t.length / 2 - 1;
        if (segs > 0) {
          var avg = 0; for (k = 0; k < Math.min(segs, 20); k++) avg += Math.hypot(t[2 * k + 2] - t[2 * k], t[2 * k + 3] - t[2 * k + 1]); avg = avg / Math.min(segs, 20) || 0.2;
          var want = FX.level === 'reduced' ? 14 : 34, step = Math.max(1, Math.ceil(0.9 / avg), Math.floor(segs / want));
          for (k = 0; k < segs; k += step) {
            var ax = t[2 * k], ay = t[2 * k + 1], bx = t[2 * Math.min(segs, k + step)], by = t[2 * Math.min(segs, k + step) + 1];
            var a = Math.atan2(by - ay, bx - ax), L = Math.min(2.2, Math.hypot(bx - ax, by - ay)), nrm = a + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2, v = 2 + Math.random() * 3;
            part((ax + bx) / 2, (ay + by) / 2, Math.cos(nrm) * v, Math.sin(nrm) * v, 0.6, 0.45, d.color, 1, a, (Math.random() - 0.5) * 9, L);
          }
        }
        break;
      case 'slash': // ניצוץ חיתוך בנקודת המגע (אצל הפוגע)
        s = special('slash', d.cutX != null ? d.cutX : d.x, d.cutY != null ? d.cutY : d.y, 380, now); s.col = '#ffffff'; s.col2 = d.killer ? d.killer.color : d.color; s.a = Math.random() * Math.PI;
        burst(s.x, s.y, 10, 7, '#fff7d6', 0.28, 0.35, 2);
        break;
      case 'pop': s = special('pop', d.x, d.y, 700, now); s.emoji = d.emoji; s.col = d.color; s.outline = d.outline; s.a = (Math.random() < 0.5 ? -1 : 1); break;
      case 'pulse': if (d.killer) { s = special('pulse', d.x, d.y, 650, now); s.col = d.killer.color; s.r = 5; } break;
      case 'cage': s = special('cage', d.x, d.y, 520, now); s.col = d.killer ? d.killer.color : '#4c566a'; s.r = 6.5; break;
      case 'implode': s = special('implode', d.x, d.y, 720, now); s.emoji = d.emoji; s.col = d.color; s.outline = d.outline; s.b = 0.5; break;
      case 'burst': burst(d.x, d.y, 18, 6, d.killer ? d.killer.color : d.color, 0.32, 0.5, 0); break;
      case 'shock': s = special('shock', d.x, d.y, 520, now); s.col = '#ffffff'; s.col2 = d.color; s.r = 5; break;
      case 'knock':
        var kx = d.killer ? Math.atan2(d.y - d.killer.y, d.x - d.killer.x) : Math.random() * TAU;
        s = special('knock', d.x, d.y, 700, now); s.emoji = d.emoji; s.col = d.color; s.outline = d.outline; s.a = Math.cos(kx); s.b = Math.sin(kx);
        break;
      case 'stars': burst(d.x, d.y, 9, 4, '#ebcb8b', 0.4, 0.7, 2); break;
      case 'wobble': s = special('wobble', d.x, d.y, 850, now); s.emoji = d.emoji; s.col = d.color; s.outline = d.outline; break;
      case 'dizzy': s = special('dizzy', d.x, d.y, 850, now); break;
      case 'dissolve':
        // השטח האחרון "מתפורר": חלקיקים אפורים-בצבע הקורבן מתוך האזור שנכבש
        var box = d.box || [d.x - 3, d.y - 3, d.x + 3, d.y + 3], cnt = FX.level === 'reduced' ? 16 : 44;
        for (i = 0; i < cnt; i++) { var qx = box[0] + Math.random() * (box[2] - box[0]), qy = box[1] + Math.random() * (box[3] - box[1]);
          part(qx, qy, (Math.random() - 0.5) * 1.5, -1 - Math.random() * 2.5, 0.8 + Math.random() * 0.3, 0.3 + Math.random() * 0.2, i % 3 ? d.color : '#9aa3b5', 0); }
        break;
      case 'fadeGrey': s = special('fadeGrey', d.x, d.y, 800, now); s.emoji = d.emoji; s.col = '#a8b0bf'; s.outline = '#7b8496'; break;
      case 'fade': s = special('fade', d.x, d.y, 600, now); s.emoji = d.emoji; s.col = d.color; s.outline = d.outline; break;
    }
    if (d.byMe) { s = special('float', d.x, d.y - 1.6, 900, now); s.text = '⚔️'; s.r = 1.3; }
    return plan;
  };

  /* כיבוש: c = { x, y, cells, taken, takenPct, gainPct, color, victimColor, box } → 'big' | 'small' | 'none' */
  FX.BIG_PCT = 1.5; FX.BIG_CELLS = 600;
  FX.captureKind = function (c) {
    if (c.taken > 0 && (c.takenPct >= FX.BIG_PCT || c.taken >= FX.BIG_CELLS)) return 'big';
    if (c.gainPct >= 0.3) return 'small';
    return 'none';
  };
  FX.capture = function (c, now) {
    var kd = FX.captureKind(c);
    if (FX.level === 'off' || kd === 'none') return kd;
    var s = special('float', c.x, c.y - 1.8, kd === 'big' ? 1000 : 750, now);
    s.text = '+' + c.gainPct.toFixed(1) + '%'; s.col = c.color; s.r = kd === 'big' ? 1.25 : 0.85;
    if (kd === 'big') {
      if (c.box && FX.level === 'full') { s = special('wave', c.box[0], c.box[1], 520, now); s.a = c.box[2]; s.b = c.box[3]; s.col = c.fill || c.color; }
      burst(c.box ? (c.box[0] + c.box[2]) / 2 : c.x, c.box ? (c.box[1] + c.box[3]) / 2 : c.y, 22, 5, c.victimColor || c.color, 0.32, 0.6, 0);
    }
    return kd;
  };

  FX.update = function (dt) {
    for (var i = n - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) { // הסרה בהחלפה עם האחרון – בלי הקצאות
        n--; px[i] = px[n]; py[i] = py[n]; vx[i] = vx[n]; vy[i] = vy[n]; life[i] = life[n]; maxl[i] = maxl[n]; sz[i] = sz[n]; col[i] = col[n]; kind[i] = kind[n]; ang[i] = ang[n]; av[i] = av[n]; len[i] = len[n];
        continue;
      }
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; vx[i] *= 0.94; vy[i] *= 0.94; ang[i] += av[i] * dt;
    }
  };

  function ease(t) { return 1 - (1 - t) * (1 - t); }
  /* v = { camX, camY, vx0, vy0, vw, vh, unitPx, wd } ; שלב 'under' (מתחת לשובלים) או 'over' */
  FX.draw = function (ctx, v, now, phase, Emoji) {
    if (FX.level === 'off') return;
    var U = v.unitPx, i, s, x, y, t;
    function sxOf(wx) { return (v.camX + v.wd(wx - v.camX) - v.vx0) * U; }
    function syOf(wy) { return (v.camY + v.wd(wy - v.camY) - v.vy0) * U; }
    var W = v.vw * U, H = v.vh * U, M = 8 * U;
    for (i = 0; i < SP; i++) {
      s = sp[i]; if (!s.on) continue;
      t = (now - s.t0) / s.dur;
      if (t >= 1 || t < -0.5) { s.on = false; continue; }
      if (t < 0) continue;
      var under = s.type === 'wave' || s.type === 'pulse';
      if (under !== (phase === 'under')) continue;
      x = sxOf(s.x); y = syOf(s.y);
      if (s.type !== 'wave' && (x < -M || y < -M || x > W + M || y > H + M)) continue;   // מחוץ למסך
      var e = ease(t), size = U * 1.9;
      ctx.save();
      switch (s.type) {
        case 'wave': { // גל צבע שחולף על האזור שנכבש (שקוף, תחום)
          var w = (s.a - s.x) * U, h = (s.b - s.y) * U;
          if (x > W + M || y > H + M || x + w < -M || y + h < -M) break;
          ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
          var bandX = x - w * 0.4 + (w * 1.8) * e;
          var gr = ctx.createLinearGradient(bandX - w * 0.35, 0, bandX + w * 0.05, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, s.col); gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = 0.5 * (1 - t); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
          break; }
        case 'pulse': ctx.globalAlpha = 0.28 * Math.sin(t * Math.PI); ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(x, y, s.r * U * (1 - 0.35 * e), 0, TAU); ctx.fill(); break;
        case 'cage': // טבעת שמתכווצת אל הכלוא, עם "סורגים"
          var r = s.r * U * (1 - e) + size * 0.35;
          ctx.globalAlpha = 0.9 * (1 - t * 0.6); ctx.strokeStyle = s.col; ctx.lineWidth = U * 0.22;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
          ctx.lineWidth = U * 0.12; ctx.beginPath();
          for (var k = 0; k < 8; k++) { var a = k / 8 * TAU + t; ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); }
          ctx.stroke(); break;
        case 'implode': { // נבלע פנימה (מתחיל אחרי שהטבעת נסגרת)
          var q = Math.max(0, (t - 0.45) / 0.55), sc = 1 - q * q;
          var shrinkSize = size * sc * (1 + 0.15 * Math.sin(t * 20) * (1 - q));
          // Tiny badge sizes make the fixed minimum outline wider than its circle.
          if (shrinkSize >= 2) { ctx.globalAlpha = 1; Emoji.draw(ctx, s.emoji, s.col, s.outline, x, y, shrinkSize, null); }
          break; }
        case 'pop': { // קופץ, מסתובב ועף הצידה
          ctx.globalAlpha = 1 - t;
          ctx.translate(x + s.a * e * U * 2.5, y - Math.sin(t * Math.PI) * U * 2.2); ctx.rotate(s.a * e * 4);
          Emoji.draw(ctx, s.emoji, s.col, s.outline, 0, 0, size * (1 + 0.35 * Math.sin(Math.min(1, t * 3) * Math.PI)), null);
          break; }
        case 'slash': // שני קווים בהירים מצטלבים + הילה
          ctx.globalAlpha = 1 - t; ctx.strokeStyle = s.col; ctx.lineCap = 'round'; ctx.lineWidth = U * 0.26 * (1 - t * 0.5);
          var L2 = U * (1.2 + 1.6 * e);
          ctx.beginPath(); ctx.moveTo(x - Math.cos(s.a) * L2, y - Math.sin(s.a) * L2); ctx.lineTo(x + Math.cos(s.a) * L2, y + Math.sin(s.a) * L2);
          ctx.moveTo(x - Math.cos(s.a + 1.2) * L2 * 0.7, y - Math.sin(s.a + 1.2) * L2 * 0.7); ctx.lineTo(x + Math.cos(s.a + 1.2) * L2 * 0.7, y + Math.sin(s.a + 1.2) * L2 * 0.7); ctx.stroke();
          ctx.strokeStyle = s.col2; ctx.lineWidth = U * 0.1; ctx.beginPath(); ctx.arc(x, y, L2 * 0.8, 0, TAU); ctx.stroke();
          break;
        case 'shock': // גל הדף
          ctx.globalAlpha = 0.85 * (1 - t); ctx.strokeStyle = s.col2; ctx.lineWidth = U * 0.3 * (1 - t) + 1;
          ctx.beginPath(); ctx.arc(x, y, U * (0.8 + s.r * e), 0, TAU); ctx.stroke();
          ctx.strokeStyle = s.col; ctx.lineWidth = U * 0.12; ctx.beginPath(); ctx.arc(x, y, U * (0.5 + s.r * 0.6 * e), 0, TAU); ctx.stroke();
          break;
        case 'knock': // נהדף אחורה ודוהה
          ctx.globalAlpha = 1 - t * t; ctx.translate(x + s.a * U * 2.6 * e, y + s.b * U * 2.6 * e); ctx.rotate(Math.sin(t * 14) * 0.35 * (1 - t));
          Emoji.draw(ctx, s.emoji, s.col, s.outline, 0, 0, size * (1 - 0.3 * t), null); break;
        case 'wobble': // מתנדנד ("סחרחורת") ודוהה
          ctx.globalAlpha = 1 - Math.max(0, (t - 0.55) / 0.45); ctx.translate(x, y); ctx.rotate(Math.sin(t * 22) * 0.45 * (1 - t));
          Emoji.draw(ctx, s.emoji, s.col, s.outline, 0, 0, size, null); break;
        case 'dizzy': // 💫 מסתובבים מעל הראש
          ctx.globalAlpha = 1 - t; ctx.font = Math.round(U * 0.9) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (var k2 = 0; k2 < 3; k2++) { var a2 = t * 9 + k2 * TAU / 3; ctx.fillText('💫', x + Math.cos(a2) * U * 1.2, y - size * 0.75 + Math.sin(a2) * U * 0.35); }
          break;
        case 'fadeGrey': case 'fade':
          ctx.globalAlpha = 0.85 * (1 - t); Emoji.draw(ctx, s.emoji, s.col, s.outline, x, y + (s.type === 'fadeGrey' ? U * e : 0), size * (1 - 0.25 * t), null); break;
        case 'float': // טקסט צף ("+3.2%", "⚔️")
          ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          ctx.font = '800 ' + Math.round(U * s.r) + 'px system-ui,sans-serif'; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var fy = y - U * 2.2 * e;
          ctx.lineWidth = Math.max(2, U * 0.18); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(s.text, x, fy);
          ctx.fillStyle = s.col || '#3b4252'; ctx.fillText(s.text, x, fy); break;
      }
      ctx.restore();
    }
    if (phase !== 'over' || !n) return;
    // חלקיקים
    ctx.save(); ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      x = sxOf(px[i]); y = syOf(py[i]);
      if (x < -M || y < -M || x > W + M || y > H + M) continue;
      var lf = life[i] / maxl[i];
      ctx.globalAlpha = lf < 0.5 ? lf * 2 : 1;
      if (kind[i] === 1) {
        var hl = len[i] * U * 0.5, c = Math.cos(ang[i]) * hl, sn = Math.sin(ang[i]) * hl;
        ctx.strokeStyle = col[i]; ctx.lineWidth = sz[i] * U; ctx.beginPath(); ctx.moveTo(x - c, y - sn); ctx.lineTo(x + c, y + sn); ctx.stroke();
      } else if (kind[i] === 2) {
        var r2 = sz[i] * U; ctx.fillStyle = col[i]; ctx.beginPath();
        ctx.moveTo(x, y - r2); ctx.lineTo(x + r2 * 0.3, y - r2 * 0.3); ctx.lineTo(x + r2, y); ctx.lineTo(x + r2 * 0.3, y + r2 * 0.3);
        ctx.lineTo(x, y + r2); ctx.lineTo(x - r2 * 0.3, y + r2 * 0.3); ctx.lineTo(x - r2, y); ctx.lineTo(x - r2 * 0.3, y - r2 * 0.3); ctx.fill();
      } else { ctx.fillStyle = col[i]; ctx.beginPath(); ctx.arc(x, y, sz[i] * U, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FX;
  else root.FX = FX;
})(this);
