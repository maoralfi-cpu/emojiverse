/* כובש – הפיכת רשת השטח לצורות אורגניות: marching squares על שדה מוחלק,
   חיבור המקטעים ללולאות, והחלקה בעקומות. מחושב רק כשהשטח של שחקן משתנה. */
(function (root) {
  'use strict';
  var bufA = null, bufB = null;

  /* מחזיר מערך לולאות; כל לולאה = מערך שטוח [x0,y0,x1,y1,...] ביחידות עולם */
  function contours(owner, G, C, id) {
    var x0 = G, y0 = G, x1 = -1, y1 = -1, i, j;
    for (j = 0; j < G; j++) { var row = j * G; for (i = 0; i < G; i++) if (owner[row + i] === id) {
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
    if (x1 < 0) return [];
    // תחום קודקודים (עם שוליים להחלקה)
    var vx0 = Math.max(0, x0 - 2), vy0 = Math.max(0, y0 - 2), vx1 = Math.min(G, x1 + 3), vy1 = Math.min(G, y1 + 3);
    var VW = vx1 - vx0 + 1, VH = vy1 - vy0 + 1, n = VW * VH;
    if (!bufA || bufA.length < n) { bufA = new Float32Array(n); bufB = new Float32Array(n); }
    var A = bufA, B = bufB;
    // ערך קודקוד = ממוצע 4 התאים סביבו
    for (j = 0; j < VH; j++) for (i = 0; i < VW; i++) {
      var gx = vx0 + i, gy = vy0 + j, s = 0;
      if (gx > 0 && gy > 0 && owner[(gy - 1) * G + gx - 1] === id) s++;
      if (gx < G && gy > 0 && owner[(gy - 1) * G + gx] === id) s++;
      if (gx > 0 && gy < G && owner[gy * G + gx - 1] === id) s++;
      if (gx < G && gy < G && owner[gy * G + gx] === id) s++;
      A[j * VW + i] = s / 4;
    }
    // החלקה 3x3
    for (j = 0; j < VH; j++) for (i = 0; i < VW; i++) {
      var sum = 0, cnt = 0;
      for (var dj = -1; dj <= 1; dj++) { var jj = j + dj; if (jj < 0 || jj >= VH) { cnt += 3; continue; }
        for (var di = -1; di <= 1; di++) { var ii = i + di; cnt++; if (ii >= 0 && ii < VW) sum += A[jj * VW + ii]; } }
      B[j * VW + i] = sum / cnt;
    }
    var T = 0.5, pts = new Map(), adj = new Map(), segs = [];
    function key(edge, i, j) { return ((j * (VW + 1) + i) << 1) | edge; } // edge 0=אופקי 1=אנכי
    function pt(k, i, j, horiz) {
      if (pts.has(k)) return;
      var v0 = B[j * VW + i], v1 = horiz ? B[j * VW + i + 1] : B[(j + 1) * VW + i], t = (T - v0) / (v1 - v0);
      pts.set(k, horiz ? [(vx0 + i + t) * C, (vy0 + j) * C] : [(vx0 + i) * C, (vy0 + j + t) * C]);
    }
    function seg(ka, kb) {
      var s = segs.length >> 1; segs.push(ka, kb);
      (adj.get(ka) || adj.set(ka, []).get(ka)).push(s);
      (adj.get(kb) || adj.set(kb, []).get(kb)).push(s);
    }
    for (j = 0; j < VH - 1; j++) for (i = 0; i < VW - 1; i++) {
      var a = B[j * VW + i], b = B[j * VW + i + 1], c = B[(j + 1) * VW + i + 1], d = B[(j + 1) * VW + i];
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
      var start = segs[2 * s0], cur = segs[2 * s0 + 1], loop = [], p = pts.get(start);
      loop.push(p[0], p[1]);
      var guard = 0;
      while (cur !== start && guard++ < 200000) {
        p = pts.get(cur); loop.push(p[0], p[1]);
        var cand = adj.get(cur), next = -1;
        for (var z = 0; z < cand.length; z++) if (!used[cand[z]]) { next = cand[z]; break; }
        if (next < 0) break;
        used[next] = 1;
        cur = segs[2 * next] === cur ? segs[2 * next + 1] : segs[2 * next];
      }
      if (loop.length >= 6) loops.push(loop);
    }
    return loops;
  }

  /* Path2D מוחלק (עקומות דרך נקודות האמצע) */
  function toPath(loops) {
    var path = new Path2D();
    for (var l = 0; l < loops.length; l++) {
      var L = loops[l], n = L.length / 2;
      var mx = (L[2 * n - 2] + L[0]) / 2, my = (L[2 * n - 1] + L[1]) / 2;
      path.moveTo(mx, my);
      for (var k = 0; k < n; k++) {
        var x = L[2 * k], y = L[2 * k + 1], k2 = (k + 1) % n;
        path.quadraticCurveTo(x, y, (x + L[2 * k2]) / 2, (y + L[2 * k2 + 1]) / 2);
      }
      path.closePath();
    }
    return path;
  }

  var api = { contours: contours, toPath: toPath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Terrain = api;
})(this);
