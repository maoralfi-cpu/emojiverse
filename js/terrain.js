/* Emojiverse (לשעבר כובש) – הפיכת רשת השטח לצורות אורגניות: marching squares על שדה מוחלק,
   חיבור המקטעים ללולאות, והחלקה בעקומות. מחושב רק כשהשטח של שחקן משתנה.
   v7 (טורוס): הדגימה עוטפת. לכל ציר מחפשים את הפער הריק הגדול ביותר (מעגלית) ומתחילים אחריו,
   כך ששטח שחוצה תפר מקבל קואורדינטות רציפות (למשל x=-3..5). אם השטח פרוש על כל הציר – הציר
   מחושב מעגלית, והלולאות "נפרשות" בזמן החיבור. לולאה שלא נסגרת אחרי פרישה (מקיפה את הטורוס)
   מסומנת ב-D (ההיסט, כפולה של W) ומצוירת כרצועה.
   v9.7: שטח שפרוש על שני הצירים – MS על רשת עם מסגרת ריקה (בלי עטיפה כפולה).
   v9.8: הוסר מלבן-המשלים (evenodd) – בדגימות דלילות הוא צבע את כל המפה בצבע שחקן. */
(function (root) {
  'use strict';
  var bufA = null, bufB = null;

  /* מחזיר מערך לולאות; כל לולאה = מערך שטוח [x0,y0,x1,y1,...] ביחידות עולם */
  function md(a, n) { a %= n; return a < 0 ? a + n : a; }
  /* תחום מעגלי מינימלי שמכסה את כל הערכים המסומנים: [התחלה, אורך]; null אם ריק */
  function circRange(occ, G) {
    var first = -1, i;
    for (i = 0; i < G; i++) if (occ[i]) { first = i; break; }
    if (first < 0) return null;
    var bestGap = 0, bestEnd = first, run = 0;
    for (var k = 1; k <= G; k++) {
      var j = (first + k) % G;
      if (!occ[j]) run++;
      else { if (run > bestGap) { bestGap = run; bestEnd = j; } run = 0; }
    }
    return [bestEnd, G - bestGap];
  }
  var occX = null, occY = null;
  function contours(owner, G, C, id) {
    var i, j, W = G * C;
    if (!occX || occX.length !== G) { occX = new Uint8Array(G); occY = new Uint8Array(G); }
    occX.fill(0); occY.fill(0);
    for (j = 0; j < G; j++) { var row = j * G; for (i = 0; i < G; i++) if (owner[row + i] === id) { occX[i] = 1; occY[j] = 1; } }
    var rx = circRange(occX, G), ry = circRange(occY, G);
    if (!rx) return [];
    // תחום קודקודים (עם שוליים להחלקה); ציר שהשטח כמעט ממלא – מעגלי
    var cycX = rx[1] + 6 >= G, cycY = ry[1] + 6 >= G;
    /* v9.7: פרוש על שני הצירים (צלב וכו') – מסגרת ריקה סביב הרשת במקום MS מעגלי כפול,
       כדי שהקונטור ייסגר סביב השטח האמיתי ולא סביב המשלים. */
    var padded = null, Gp = G;
    var vx0, vy0, VW, VH;
    if (cycX && cycY) {
      cycX = false; cycY = false;
      Gp = G + 2; padded = new Uint8Array(Gp * Gp);
      for (j = 0; j < G; j++) for (i = 0; i < G; i++) if (owner[j * G + i] === id) padded[(j + 1) * Gp + (i + 1)] = 1;
      vx0 = -1; vy0 = -1; VW = Gp; VH = Gp;
    } else {
      vx0 = cycX ? 0 : rx[0] - 2; vy0 = cycY ? 0 : ry[0] - 2;
      VW = cycX ? G : rx[1] + 5; VH = cycY ? G : ry[1] + 5;
    }
    var n = VW * VH;
    if (!bufA || bufA.length < n) { bufA = new Float32Array(n); bufB = new Float32Array(n); }
    var A = bufA, B = bufB;
    function cellOn(gx, gy) {
      if (padded) {
        var ii = gx + 1, jj = gy + 1;
        return (ii >= 0 && jj >= 0 && ii < Gp && jj < Gp && padded[jj * Gp + ii]) ? 1 : 0;
      }
      return owner[md(gy, G) * G + md(gx, G)] === id ? 1 : 0;
    }
    // ערך קודקוד = ממוצע 4 התאים סביבו (דגימה עוטפת / מרופדת)
    for (j = 0; j < VH; j++) {
      var gy = vy0 + j;
      for (i = 0; i < VW; i++) {
        var gx = vx0 + i;
        A[j * VW + i] = (cellOn(gx - 1, gy - 1) + cellOn(gx, gy - 1) + cellOn(gx - 1, gy) + cellOn(gx, gy)) / 4;
      }
    }
    // החלקה 3x3 (מעגלית בציר מעגלי; מחוץ לתחום – אפס, כי שם אין שטח)
    for (j = 0; j < VH; j++) for (i = 0; i < VW; i++) {
      var sum = 0;
      for (var dj = -1; dj <= 1; dj++) { var jj = j + dj; if (cycY) jj = md(jj, VH); else if (jj < 0 || jj >= VH) continue;
        for (var di = -1; di <= 1; di++) { var ii = i + di; if (cycX) ii = md(ii, VW); else if (ii < 0 || ii >= VW) continue; sum += A[jj * VW + ii]; } }
      B[j * VW + i] = sum / 9;
    }
    var IX = function (i) { return cycX && i >= VW ? i - VW : i; }, IY = function (j) { return cycY && j >= VH ? j - VH : j; };
    var T = 0.5, pts = new Map(), adj = new Map(), segs = [];
    function key(edge, i, j) { return ((IY(j) * (VW + 1) + IX(i)) << 1) | edge; } // edge 0=אופקי 1=אנכי
    function pt(k, i, j, horiz) {
      if (pts.has(k)) return;
      i = IX(i); j = IY(j);
      var v0 = B[j * VW + i], v1 = horiz ? B[j * VW + IX(i + 1)] : B[IY(j + 1) * VW + i], t = (T - v0) / (v1 - v0);
      pts.set(k, horiz ? [(vx0 + i + t) * C, (vy0 + j) * C] : [(vx0 + i) * C, (vy0 + j + t) * C]);
    }
    function seg(ka, kb) {
      var s = segs.length >> 1; segs.push(ka, kb);
      (adj.get(ka) || adj.set(ka, []).get(ka)).push(s);
      (adj.get(kb) || adj.set(kb, []).get(kb)).push(s);
    }
    var SW = cycX ? VW : VW - 1, SH = cycY ? VH : VH - 1;
    for (j = 0; j < SH; j++) for (i = 0; i < SW; i++) {
      var i1 = IX(i + 1), j1 = IY(j + 1);
      var a = B[j * VW + i], b = B[j * VW + i1], c = B[j1 * VW + i1], d = B[j1 * VW + i];
      var cs = (a > T ? 1 : 0) | (b > T ? 2 : 0) | (c > T ? 4 : 0) | (d > T ? 8 : 0);
      if (cs === 0 || cs === 15) continue;
      var eT = key(0, i, j), eB = key(0, i, j + 1), eL = key(1, i, j), eR = key(1, i + 1, j);
      var center = (a + b + c + d) / 4 > T;
      var list;
      switch (cs) {
        case 1: case 14: list = [eL, eT]; break;
        case 2: case 13: list = [eT, eR]; break;
        case 3: case 12: list = [eL, eR]; break;
        case 4: case 11: list = [eR, eB]; break;
        case 6: case 9: list = [eT, eB]; break;
        case 7: case 8: list = [eL, eB]; break;
        case 5: list = center ? [eT, eR, eB, eL] : [eL, eT, eR, eB]; break;
        case 10: list = center ? [eL, eT, eR, eB] : [eT, eR, eB, eL]; break;
      }
      for (var q = 0; q < list.length; q += 2) {
        for (var w = q; w < q + 2; w++) {
          var k = list[w];
          if (k === eT) pt(k, i, j, true); else if (k === eB) pt(k, i, j + 1, true);
          else if (k === eL) pt(k, i, j, false); else pt(k, i + 1, j, false);
        }
        seg(list[q], list[q + 1]);
      }
    }
    // חיבור ללולאות
    var used = new Uint8Array(segs.length / 2), loops = [];
    for (var s0 = 0; s0 < used.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      var start = segs[2 * s0], cur = segs[2 * s0 + 1], loop = [], p = pts.get(start), lx = p[0], ly = p[1];
      loop.push(lx, ly);
      var guard = 0;
      while (cur !== start && guard++ < 200000) {
        // פרישה: כל נקודה קרובה לקודמת (מבטל קפיצות W בציר מעגלי)
        p = pts.get(cur); lx += wd(p[0] - lx, W); ly += wd(p[1] - ly, W); loop.push(lx, ly);
        var cand = adj.get(cur), next = -1;
        for (var z = 0; z < cand.length; z++) if (!used[cand[z]]) { next = cand[z]; break; }
        if (next < 0) break;
        used[next] = 1;
        cur = segs[2 * next] === cur ? segs[2 * next + 1] : segs[2 * next];
      }
      if (loop.length >= 6) {
        var sx = lx + wd(loop[0] - lx, W) - loop[0], sy = ly + wd(loop[1] - ly, W) - loop[1];
        loop.D = [Math.round(sx / W) * W, Math.round(sy / W) * W];   // [0,0] = לולאה רגילה
        loops.push(loop);
      }
    }
    return loops;
  }
  function wd(d, W) { d %= W; if (d > W / 2) d -= W; else if (d < -W / 2) d += W; return d; }

  /* האם (x,y) בתוך לולאות חוזיות (D=0) לפי evenodd / ray-casting. רצועות (D≠0) לא נספרות כאן. */
  function pointInLoops(loops, x, y) {
    var inside = false;
    for (var l = 0; l < loops.length; l++) {
      var L = loops[l], D = L.D || [0, 0];
      if (D[0] || D[1]) continue;
      var n = L.length / 2;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        var yi = L[2 * i + 1], yj = L[2 * j + 1];
        if ((yi > y) === (yj > y)) continue;
        var xi = L[2 * i], xj = L[2 * j];
        if (x < (xj - xi) * (y - yi) / (yj - yi + 0.0) + xi) inside = !inside;
      }
    }
    return inside;
  }

  /* Path2D מוחלק. רצועה (D≠0) – band+evenodd; לולאה רגילה – addLoop.
     v9.8: בלי מלבן-משלים – בדגימות שטח דלילות (או צלב דק) hits=0 היה צובע את כל המפה. */
  function toPath(loops) {
    var path = new Path2D(), stroke = null, k;
    for (var l = 0; l < loops.length; l++) {
      var L = loops[l], n = L.length / 2, D = L.D || [0, 0];
      if (D[0] || D[1]) {
        if (!stroke) { stroke = new Path2D(); for (k = 0; k < l; k++) if (!(loops[k].D && (loops[k].D[0] || loops[k].D[1]))) addLoop(stroke, loops[k]); }
        band(path, stroke, L, D);
        continue;
      }
      addLoop(path, L); if (stroke) addLoop(stroke, L);
    }
    return { fill: path, stroke: stroke || path };
  }

  /* בונה path מהקונטורים. v9.7 padded dual-cyclic מטפל בצלב; בלי complement מסוכן. */
  function build(owner, G, C, id) {
    var loops = contours(owner, G, C, id);
    if (!loops.length) return null;
    return toPath(loops);
  }

  /* האם ה-complement הישן היה נדלק (לבדיקות רגרסיה) – hits==0 ואין רצועה. */
  function wouldComplement(owner, G, C, id) {
    var loops = contours(owner, G, C, id);
    if (!loops.length) return false;
    var hasBand = false, l, k;
    for (l = 0; l < loops.length; l++) {
      var D = loops[l].D || [0, 0];
      if (D[0] || D[1]) hasBand = true;
    }
    if (hasBand) return false;
    var pts = [], n = owner.length, step = Math.max(1, (n / 64) | 0);
    for (k = 0; k < n && pts.length < 8; k += step) if (owner[k] === id)
      pts.push([(k % G + 0.5) * C, (((k / G) | 0) + 0.5) * C]);
    if (!pts.length) return false;
    var hits = 0;
    for (k = 0; k < pts.length; k++) if (pointInLoops(loops, pts[k][0], pts[k][1])) hits++;
    return hits === 0;
  }
  var COPIES = 3;
  function band(fill, stroke, L, D) {
    var n = L.length / 2, dl = Math.hypot(D[0], D[1]);
    var cx = D[0], cy = D[1]; if (cx < 0 || (cx === 0 && cy < 0)) { cx = -cx; cy = -cy; }
    var far = 50 * dl, nx = -cy / dl * far, ny = cx / dl * far;
    var pts = [];
    for (var c = -COPIES; c <= COPIES; c++) for (var k = 0; k < n; k++) pts.push(L[2 * k] + D[0] * c, L[2 * k + 1] + D[1] * c);
    var m = pts.length / 2;
    function trace(path) {
      path.moveTo(pts[0], pts[1]);
      for (var k = 1; k < m - 1; k++) path.quadraticCurveTo(pts[2 * k], pts[2 * k + 1], (pts[2 * k] + pts[2 * k + 2]) / 2, (pts[2 * k + 1] + pts[2 * k + 3]) / 2);
      path.lineTo(pts[2 * m - 2], pts[2 * m - 1]);
    }
    trace(fill);
    fill.lineTo(pts[2 * m - 2] + nx, pts[2 * m - 1] + ny); fill.lineTo(pts[0] + nx, pts[1] + ny); fill.closePath();
    trace(stroke);
  }
  function addLoop(path, L) {
    {
      var n = L.length / 2;
      var mx = (L[2 * n - 2] + L[0]) / 2, my = (L[2 * n - 1] + L[1]) / 2;
      path.moveTo(mx, my);
      for (var k = 0; k < n; k++) {
        var x = L[2 * k], y = L[2 * k + 1], k2 = (k + 1) % n;
        path.quadraticCurveTo(x, y, (x + L[2 * k2]) / 2, (y + L[2 * k2 + 1]) / 2);
      }
      path.closePath();
    }
  }

  var api = { contours: contours, toPath: toPath, build: build, pointInLoops: pointInLoops, wouldComplement: wouldComplement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Terrain = api;
})(this);
