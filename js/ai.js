/* Emojiverse (לשעבר כובש) – בינה מלאכותית לבוטים בתנועה רציפה. נכתב מאפס.
   גיחה: יציאה בקו, קשת סיבוב, חזרה הביתה; בריחה כשאויב קרוב; ציד שובלים; בדיקת בטיחות קדימה. */
(function (root) {
  'use strict';
  var Game = root.Game || (typeof require !== 'undefined' ? require('./game.js') : null);
  var TAU = Math.PI * 2, angDiff = Game.angDiff;

  var LEVELS = {
    // מרחקים ביחידות עולם; arcR = רדיוס קשת החזרה; probe = מרחק בדיקה קדימה (גדל עם המהירות)
    easy:   { outMin: 6,  outMax: 14, maxLen: 23, danger: 8,  hunt: 0.0, huntR: 0,  arcR: 4.4, probe: 4.0 },
    normal: { outMin: 8,  outMax: 22, maxLen: 36, danger: 10, hunt: 0.3, huntR: 12, arcR: 3.9, probe: 4.6 },
    hard:   { outMin: 10, outMax: 30, maxLen: 49, danger: 13, hunt: 0.6, huntR: 18, arcR: 3.6, probe: 5.2 }
  };
  var OFFS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.0, -2.0, 2.6, -2.6, 3.1];

  function dangerAt(g, p, x, y) {
    // v7: טורוס – אין קירות; רק השובל העצמי מסוכן (trailDist2 כבר עוטף)
    return (g.pitSystem && g.pitSystem.dangerAt(g, x, y, 1.4)) || g.trailDist2(p, x, y, g.SELF_SKIP, false) < 1.2 * 1.2;
  }
  function safeHeading(g, p, a, probe) {
    var c = Math.cos(a), s = Math.sin(a);
    for (var d = 0.8; d <= probe; d += 0.8) if (dangerAt(g, p, p.x + c * d, p.y + s * d)) return false;
    return true;
  }
  function enemyDist(g, p) {
    var best = Infinity, t = p.trail;
    for (var k = 0; k < g.players.length; k++) {
      var q = g.players[k];
      if (!q.alive || q === p) continue;
      var d = Math.sqrt(g.dist2(q.x, q.y, p.x, p.y));
      for (var i = 0; i < t.length; i += 8) { var dd = Math.sqrt(g.dist2(q.x, q.y, t[i], t[i + 1])); if (dd < d) d = dd; }
      if (d < best) best = d;
    }
    return best;
  }

  function think(g, p, level) {
    var L = LEVELS[level] || LEVELS.normal;
    var ai = p.ai || (p.ai = { mode: 'home', t: 0, exitH: g.rand() * TAU, turned: 0, dir: 1, goal: null, goalT: 0, homeT: 0 });
    var home = g.ownerAt(p.x, p.y) === p.id, out = p.trail.length > 0, want = p.h;
    ai.t++;
    var K = g.AI_EVERY || 1, STEP = g.SPEED * g.DT * K; // צעד "מחשבה" בזמן/מרחק, לא תלוי בקצב הלוגיקה

    if (!out && home && ai.mode !== 'home' && ai.mode !== 'hunt') { ai.mode = 'home'; ai.homeT = 0; ai.exitH = p.h + (g.rand() - 0.5) * 2.4; }

    // ציד
    if (L.hunt > 0 && ai.mode !== 'return' && p.trail.length < 16 * K && ai.mode !== 'hunt' && g.tickNo % 6 === p.id % 6 && g.rand() < L.hunt) {
      var bd = Infinity, tx = 0, ty = 0;
      for (var k = 0; k < g.players.length; k++) {
        var q = g.players[k];
        if (!q.alive || q === p || q.trail.length < 6 * K) continue;
        var tr = q.trail;
        for (var i = 0; i < tr.length; i += 4 * K) {
          var d = Math.sqrt(g.dist2(tr[i], tr[i + 1], p.x, p.y)) - (q.isBot ? 0 : 2);
          if (d < bd) { bd = d; tx = tr[i]; ty = tr[i + 1]; }
        }
      }
      if (bd <= L.huntR) { ai.mode = 'hunt'; ai.goal = { x: tx, y: ty }; ai.huntT = 0; }
    }

    if (ai.mode === 'hunt') {
      ai.huntT++;
      if (ai.huntT > 90 || p.trail.length / 2 * g.SPEED * g.DT > L.maxLen / 2) ai.mode = out ? 'return' : 'home';
      else want = Math.atan2(g.wd(ai.goal.y - p.y), g.wd(ai.goal.x - p.x));
    }

    if (ai.mode === 'home') {
      ai.homeT++;
      if (out) {
        // יצאנו מהשטח – מתכננים גיחה
        ai.mode = 'out'; ai.t = 0; ai.exitH = p.h; ai.turned = 0; ai.dir = g.rand() < 0.5 ? 1 : -1;
        ai.straight = Math.round((L.outMin + g.rand() * (L.outMax - L.outMin)) / STEP * 0.5);
        ai.arcTotal = Math.PI * (0.85 + g.rand() * 0.4);
      } else {
        if (ai.homeT % 38 === 0) ai.exitH += (g.rand() - 0.5) * 1.5;
        want = ai.exitH;
      }
    }

    if (ai.mode === 'out') {
      if (p.trail.length / 2 * g.SPEED * g.DT > L.maxLen || enemyDist(g, p) < L.danger && p.trail.length > 8 * K) ai.mode = 'return';
      else if (ai.t < ai.straight) want = ai.exitH + Math.sin(ai.t * 0.15) * 0.15;
      else {
        var r = STEP / L.arcR * ai.dir;
        want = p.h + r; ai.turned += Math.abs(r);
        if (ai.turned >= ai.arcTotal) { ai.mode = 'return'; ai.goalT = 0; }
      }
    }

    if (ai.mode === 'return') {
      if (!out) { ai.mode = 'home'; ai.homeT = 0; }
      else {
        if (!ai.goal || ai.goalT-- <= 0) { ai.goal = g.nearestOwn(p, 160) || { x: p.homeX, y: p.homeY }; ai.goalT = 5; }
        want = Math.atan2(g.wd(ai.goal.y - p.y), g.wd(ai.goal.x - p.x));   // הדרך הקצרה הביתה על הטורוס
      }
    }

    // בדיקת בטיחות: הכיוון הקרוב לרצוי שאינו מוביל לשובל העצמי
    var chosen = want;
    for (var o = 0; o < OFFS.length; o++) {
      var a = want + OFFS[o];
      if (safeHeading(g, p, a, L.probe)) { chosen = a; break; }
    }
    if (o > 2 && ai.mode === 'out') ai.mode = 'return';
    p.target = chosen;
  }

  var AI = { think: think, LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else root.AI = AI;
})(this);
