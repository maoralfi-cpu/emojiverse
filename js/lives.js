/* Emojiverse – מצב חיים (v9.13). לוגיקה טהורה, בלי DOM (נבדק ב-node).
   מספר חיים מוגבל; מי שנפסל מאבד חיים אחד וחוזר אחרי ~3 שנ' עם הגנה קצרה; ב-0 חיים – מודח וצופה.
   הסיבוב נגמר כשנשאר רק שחקן אחד עם חיים (או אף אחד – תיקו בין מי שנפל אחרון).
   המארח (או הסולו) מחליט על הכול; הלקוחות רק מציגים. */
(function (root) {
  'use strict';

  var OPTIONS = [3, 5], DEFAULT = 3, CAP_EXTRA = 2;
  var PROTECT_TICKS = 90;                 // ~1.5 שנ' הגנה אחרי חזרה לחיים
  var PROTECT_MS = 1500;
  var SAFETY_TICKS = 15 * 60 * 60;        // תקרת בטיחות שקטה: 15 דקות
  var END_DELAY = 45;                     // ~0.75 שנ' לאפקט הפסילה האחרונה לפני מסך התוצאות

  function norm(n) { n = +n; return OPTIONS.indexOf(n) >= 0 ? n : DEFAULT; }
  function cap(start) { return norm(start) + CAP_EXTRA; }

  function initPlayer(p, start) {
    p.lives = norm(start); p.lastDeathTick = 0; p.invulnUntil = 0; p.protMs = 0;
    return p;
  }
  function init(players, start) { for (var i = 0; i < players.length; i++) initPlayer(players[i], start); return players; }

  /* פסילה: מורידים חיים אחד (פעם אחת לכל פסילה). מחזיר את מספר החיים שנשארו */
  function onDeath(p, tick) {
    p.lives = Math.max(0, (p.lives || 0) - 1);
    p.lastDeathTick = tick || 0;
    p.invulnUntil = 0;
    return p.lives;
  }
  function isOut(p) { return !!p.gone || (p.lives || 0) <= 0; }
  /* האם מותר להחזיר לחיים. livesOn=false => מצב סיבובים: תמיד (כמו היום) */
  function shouldRespawn(p, livesOn) { return !p.gone && (!livesOn || (p.lives || 0) > 0); }
  function protect(p, tick, nowMs) { p.invulnUntil = (tick || 0) + PROTECT_TICKS; if (nowMs != null) p.protMs = nowMs + PROTECT_MS; }
  function isProtected(p, tick) { return !!p.invulnUntil && tick < p.invulnUntil; }

  /* סולו: האם פסילה של השחקן היא סוף משחק? (רגיל – תמיד; חיים – רק ב-0) */
  function soloGameOver(me, livesOn) { return !livesOn || (me.lives || 0) <= 0; }

  /* צעד חזרה לחיים לשחקן אחד (מארח/סולו). בדיוק כמו קודם במצב רגיל; במצב חיים – רק עם חיים, ועם הגנה.
     מחזיר true אם השחקן חזר בצעד הזה. */
  function respawnStep(g, p, livesOn, delay, nowMs) {
    if (p.alive || !shouldRespawn(p, livesOn)) return false;
    if (!p.respawnAt) { p.respawnAt = g.tickNo + delay; return false; }
    if (g.tickNo < p.respawnAt) return false;
    if (!g.spawn(p)) { p.respawnAt = g.tickNo + 10; return false; }
    p.respawnAt = 0;
    if (livesOn) protect(p, g.tickNo, nowMs);
    return true;
  }

  function standing(players) { return players.filter(function (p) { return !p.gone && (p.lives || 0) > 0; }); }

  /* סוף סיבוב? { over, winners:[שחקנים], tie }
     - נשאר אחד עם חיים => הוא המנצח.
     - אף אחד => תיקו בין מי שנפל אחרון (אותו צעד).
     - פחות משני משתתפים מלכתחילה (סולו בלי בוטים) – לא נגמר עד שאין חיים בכלל. */
  function matchOver(players) {
    var live = players.filter(function (p) { return !p.gone; });
    var st = standing(live);
    if (st.length > 1) return { over: false, winners: [], tie: false };
    if (st.length === 1) {
      if (players.length < 2) return { over: false, winners: [], tie: false };   // משחק של שחקן יחיד מלכתחילה
      return { over: true, winners: st, tie: false };
    }
    if (!live.length) return { over: true, winners: [], tie: false };
    var last = -1;
    live.forEach(function (p) { if ((p.lastDeathTick || 0) > last) last = p.lastDeathTick || 0; });
    var w = live.filter(function (p) { return (p.lastDeathTick || 0) === last; });
    return { over: true, winners: w, tie: w.length > 1 };
  }

  /* תקרת בטיחות: מנצחים = מי שעדיין עם חיים, לפי חיים → שיא שטח → הריגות */
  function safetyWinners(players, peakOf) {
    var st = standing(players);
    if (!st.length) return matchOver(players).winners;
    st.sort(function (a, b) { return (b.lives - a.lives) || (peakOf(b) - peakOf(a)) || (b.kills - a.kills); });
    var t = st[0];
    return st.filter(function (p) { return p.lives === t.lives && peakOf(p) === peakOf(t) && p.kills === t.kills; });
  }

  /* דירוג במצב חיים (שורות פשוטות: id, lives, lastDeathTick, kills, peak, win).
     מנצח/ים קודם; אחר כך מי שעדיין עם חיים (חיים → שיא → הריגות); ואז המודחים – מי ששרד יותר זמן,
     ואז הריגות, ואז שיא שטח. השטח בסוף הסיבוב לא משמש למיון. */
  function rankRows(rows) {
    rows = rows.slice().sort(function (a, b) {
      if (!!b.win !== !!a.win) return b.win ? 1 : -1;
      var al = (a.lives || 0) > 0, bl = (b.lives || 0) > 0;
      if (al !== bl) return bl ? 1 : -1;
      if (al) return (b.lives - a.lives) || (b.peak - a.peak) || (b.kills - a.kills);
      return ((b.lastDeathTick || 0) - (a.lastDeathTick || 0)) || (b.kills - a.kills) || (b.peak - a.peak);
    });
    rows.forEach(function (r, i) { r.place = r.win ? 1 : i + 1; });   // תיקו במקום הראשון: 1,1,3…
    return rows;
  }

  /* חבילת ❤️: מותר לאסוף רק מתחת לתקרה; לא מופיעה כשכל השחקנים הפעילים בתקרה */
  function canGain(p, start) { return !p.gone && (p.lives || 0) > 0 && (p.lives || 0) < cap(start); }
  function gain(p, start) { if (!canGain(p, start)) return false; p.lives++; return true; }
  function anyoneCanGain(players, start) { return players.some(function (p) { return p.alive && canGain(p, start); }); }

  /* תצוגה: לבבות מלאים + ריקים עד מספר ההתחלה; יותר מ-5 => ❤️×n */
  function hearts(lives, start) {
    lives = Math.max(0, lives | 0); var total = Math.max(norm(start), lives);
    if (total > 5) return '❤️×' + lives;
    var s = ''; for (var i = 0; i < total; i++) s += i < lives ? '❤️' : '🤍';
    return s;
  }

  var Lives = {
    OPTIONS: OPTIONS, DEFAULT: DEFAULT, CAP_EXTRA: CAP_EXTRA, PROTECT_TICKS: PROTECT_TICKS, PROTECT_MS: PROTECT_MS,
    SAFETY_TICKS: SAFETY_TICKS, END_DELAY: END_DELAY,
    norm: norm, cap: cap, init: init, initPlayer: initPlayer, onDeath: onDeath, isOut: isOut, shouldRespawn: shouldRespawn,
    protect: protect, soloGameOver: soloGameOver, respawnStep: respawnStep, isProtected: isProtected, standing: standing, matchOver: matchOver, safetyWinners: safetyWinners,
    rankRows: rankRows, canGain: canGain, gain: gain, anyoneCanGain: anyoneCanGain, hearts: hearts
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lives;
  else root.Lives = Lives;
})(this);
