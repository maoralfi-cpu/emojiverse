/* כובש – בינה מלאכותית פשוטה לבוטים. נכתב מאפס. */
(function (root) {
  'use strict';
  var Game = root.Game || (typeof require !== 'undefined' ? require('./game.js') : null);
  var DX = Game.DX, DY = Game.DY;

  var LEVELS = {
    easy:   { maxOut: 7,  maxTrail: 22, danger: 4, hunt: 0.0,  huntR: 0,  smart: false, randTurn: 0.08 },
    normal: { maxOut: 11, maxTrail: 34, danger: 6, hunt: 0.35, huntR: 9,  smart: true,  randTurn: 0.05 },
    hard:   { maxOut: 15, maxTrail: 48, danger: 8, hunt: 0.7,  huntR: 14, smart: true,  randTurn: 0.03 }
  };

  function ri(g, a, b) { return a + Math.floor(g.rand() * (b - a + 1)); }

  function safe(g, p, d) {
    var x = p.x + DX[d], y = p.y + DY[d];
    if (!g.inBounds(x, y)) return false;
    return g.trail[g.idx(x, y)] !== p.id;
  }

  function nearestEnemy(g, p) {
    var best = 1e9, who = null;
    for (var k = 0; k < g.players.length; k++) {
      var q = g.players[k];
      if (!q.alive || q === p) continue;
      // המרחק של האויב מהשובל שלי (בדיקה מדגמית) ומהראש שלי
      var d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
      var tc = p.trailCells;
      for (var t = 0; t < tc.length; t += 3) {
        var cx = tc[t] % g.N, cy = (tc[t] - cx) / g.N;
        var dd = Math.abs(q.x - cx) + Math.abs(q.y - cy);
        if (dd < d) d = dd;
      }
      if (d < best) { best = d; who = q; }
    }
    return { d: best, who: who };
  }

  function think(g, p, level) {
    var L = LEVELS[level] || LEVELS.normal;
    var ai = p.ai || (p.ai = { mode: 'home', legs: [], legStep: 0, target: -1, homeSteps: 0 });
    var N = g.N, here = g.idx(p.x, p.y), atHome = g.owner[here] === p.id;
    var want = -1;

    if (atHome && p.trailCells.length === 0 && ai.mode !== 'home' && ai.mode !== 'hunt') {
      ai.mode = 'home'; ai.legs = []; ai.homeSteps = 0;
    }

    // ציד: שובל של שחקן אחר קרוב
    if (L.hunt > 0 && ai.mode !== 'return' && p.trailCells.length < 8) {
      if (ai.mode !== 'hunt' && g.tickNo % 4 === p.id % 4 && g.rand() < L.hunt) {
        var best = 1e9, tgt = -1;
        for (var k = 0; k < g.players.length; k++) {
          var q = g.players[k];
          if (!q.alive || q === p || !q.trailCells.length) continue;
          var tc = q.trailCells;
          for (var t = 0; t < tc.length; t += 2) {
            var cx = tc[t] % N, cy = (tc[t] - cx) / N;
            var d = Math.abs(cx - p.x) + Math.abs(cy - p.y) - (q.isBot ? 0 : 2);
            if (d < best) { best = d; tgt = tc[t]; }
          }
        }
        if (tgt >= 0 && best <= L.huntR) { ai.mode = 'hunt'; ai.target = tgt; ai.huntTicks = 0; }
      }
    }

    if (ai.mode === 'hunt') {
      ai.huntTicks++;
      if (!g.trail[ai.target] || g.trail[ai.target] === p.id || p.trailCells.length > L.maxTrail / 2 || ai.huntTicks > 30) {
        ai.mode = p.trailCells.length ? 'return' : 'home';
      } else {
        var T = ai.target;
        want = g.bfsFirstStep(p, function (c) { return c === T; }, 1500);
        if (want < 0) ai.mode = 'return';
      }
    }

    if (ai.mode === 'home') {
      // מסתובבים בשטח הבית ויוצאים לגיחה
      ai.homeSteps++;
      if (!atHome) {
        // יצאנו – מתכננים מלבן
        var s = g.rand() < 0.5 ? 1 : 3; // ימינה/שמאלה
        var a = ri(g, 2, L.maxOut), b = ri(g, 2, L.maxOut);
        var d1 = (p.dir + s) % 4, d2 = (p.dir + 2 * s) % 4;
        ai.legs = [[p.dir, a], [d1, b], [d2, a + ri(g, 0, 3)]];
        ai.legStep = 0; ai.mode = 'out';
      } else {
        want = p.dir;
        if (g.rand() < L.randTurn * 2 || !safe(g, p, want)) want = (p.dir + (g.rand() < 0.5 ? 1 : 3)) % 4;
      }
    }

    if (ai.mode === 'out') {
      var e = nearestEnemy(g, p);
      if (p.trailCells.length >= L.maxTrail || (e.d <= L.danger && p.trailCells.length > 2)) ai.mode = 'return';
      else if (!ai.legs.length) ai.mode = 'return';
      else {
        var leg = ai.legs[0];
        want = leg[0];
        ai.legStep++;
        if (ai.legStep >= leg[1]) { ai.legs.shift(); ai.legStep = 0; }
        if (atHome && p.trailCells.length === 0) ai.mode = 'home';
      }
    }

    if (ai.mode === 'return') {
      if (!p.trailCells.length && atHome) { ai.mode = 'home'; want = p.dir; }
      else {
        var id = p.id;
        want = g.bfsFirstStep(p, function (c) { return g.owner[c] === id; }, 6000);
      }
    }

    if (g.rand() < L.randTurn * 0.3 && ai.mode === 'out') want = (p.dir + (g.rand() < 0.5 ? 1 : 3)) % 4;

    // סינון בטיחות: לא לאחור, לא לקיר, לא לשובל של עצמי, ולא למבוי סתום
    if (want < 0 || want === (p.dir + 2) % 4) want = p.dir;
    var limit = L.smart ? 60 : 12;
    function ok(d) {
      if (d === (p.dir + 2) % 4 || !safe(g, p, d)) return false;
      return g.space(p, p.x + DX[d], p.y + DY[d], limit) >= Math.min(limit, p.trailCells.length + 4);
    }
    if (!ok(want)) {
      var opts = [p.dir, (p.dir + 1) % 4, (p.dir + 3) % 4], bestD = -1, bestS = -1;
      for (var o = 0; o < 3; o++) {
        var dd2 = opts[o];
        if (dd2 === (p.dir + 2) % 4 || !safe(g, p, dd2)) continue;
        var sp = g.space(p, p.x + DX[dd2], p.y + DY[dd2], 200);
        if (sp > bestS) { bestS = sp; bestD = dd2; }
      }
      if (bestD >= 0) want = bestD;
      if (ai.mode === 'out') ai.mode = 'return';
    }
    if (want !== p.dir) g.turn(p, want);
  }

  var AI = { think: think, LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else root.AI = AI;
})(this);
