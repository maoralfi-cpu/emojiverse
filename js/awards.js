/* Emojiverse – ניקוד מצטבר וזכיות במשחק אונליין (טהור, ללא DOM, נבדק ב-node).
   סיכום לאורך סיבובים: הריגות, סך אחוזי שטח בסוף סיבוב, ומיתות.
   תארים מחושבים אצל המארח ומשודרים ללקוחות. */
(function (root) {
  'use strict';

  function empty() { return {}; }

  function cloneRow(t) {
    return { key: t.key, name: t.name, emoji: t.emoji, avatar: t.avatar, color: t.color, isBot: !!t.isBot, kills: t.kills || 0, pct: t.pct || 0, deaths: t.deaths || 0, rounds: t.rounds || 0 };
  }

  /* מוסיף סיבוב לסיכום. לא משנה את הקלט. כפילות לפי מפתח באותו סיבוב נספרת פעם אחת (עדיפות למי שעדיין בחדר). */
  function addRound(totals, entries) {
    var out = {}, key, i, e, prev, pick = {};
    if (totals) {
      for (key in totals) if (Object.prototype.hasOwnProperty.call(totals, key)) out[key] = cloneRow(totals[key]);
    }
    for (i = 0; i < (entries || []).length; i++) {
      e = entries[i];
      if (!e || !e.key) continue;
      prev = pick[e.key];
      if (!prev) { pick[e.key] = e; continue; }
      // אותו מפתח פעמיים בסיבוב (עזב וחזר): מחברים הריגות/מיתות, ואחוז השטח של מי שנשאר
      var live = !e.gone ? e : (!prev.gone ? prev : e);
      pick[e.key] = {
        key: e.key,
        name: live.name, emoji: live.emoji, avatar: live.avatar, color: live.color, isBot: live.isBot,
        kills: (prev.kills || 0) + (e.kills || 0),
        pct: live.pct, deaths: (prev.deaths || 0) + (e.deaths || 0),
        gone: !!(prev.gone && e.gone)
      };
    }
    for (key in pick) if (Object.prototype.hasOwnProperty.call(pick, key)) {
      e = pick[key];
      prev = out[key];
      out[key] = {
        key: key,
        name: e.name != null ? e.name : (prev && prev.name),
        emoji: e.emoji != null ? e.emoji : (prev && prev.emoji),
        avatar: e.avatar != null ? e.avatar : (prev && prev.avatar),
        color: e.color != null ? e.color : (prev && prev.color),
        isBot: e.isBot != null ? !!e.isBot : !!(prev && prev.isBot),
        kills: (prev ? prev.kills : 0) + (e.kills || 0),
        pct: Math.round(((prev ? prev.pct : 0) + (e.pct || 0)) * 10) / 10,
        deaths: (prev ? prev.deaths : 0) + (e.deaths || 0),
        rounds: (prev ? prev.rounds : 0) + 1
      };
    }
    return out;
  }

  /* רק שחקנים שעדיין בחדר (לא עזבו) וששיחקו לפחות סיבוב אחד, לפי סדר המפתחות. */
  function present(totals, presentKeys) {
    var rows = [], i, key, t;
    if (!totals || !presentKeys) return rows;
    for (i = 0; i < presentKeys.length; i++) {
      key = presentKeys[i]; t = totals[key];
      if (t && t.rounds > 0) rows.push(t);
    }
    return rows;
  }

  function person(p) { return { key: p.key, name: p.name, emoji: p.emoji }; }

  /* תארים מתוך רשימת הנוכחים בלבד. תיקו מתחלק; מלך בלי ערך (הכול 0) מוסתר. */
  function awards(list) {
    var out = { kills: [], territory: [], double: [], undefeated: [] };
    if (!list || !list.length) return out;
    var i, maxK = 0, maxP = 0, kset = {};
    for (i = 0; i < list.length; i++) if ((list[i].kills || 0) > maxK) maxK = list[i].kills;
    if (maxK > 0) for (i = 0; i < list.length; i++) if (list[i].kills === maxK) out.kills.push(person(list[i]));
    for (i = 0; i < list.length; i++) if ((list[i].pct || 0) > maxP) maxP = list[i].pct;
    if (maxP > 0) for (i = 0; i < list.length; i++) if (Math.abs((list[i].pct || 0) - maxP) < 1e-9) out.territory.push(person(list[i]));
    for (i = 0; i < out.kills.length; i++) kset[out.kills[i].key] = true;
    for (i = 0; i < out.territory.length; i++) if (kset[out.territory[i].key]) out.double.push(out.territory[i]);
    for (i = 0; i < list.length; i++) if ((list[i].deaths || 0) === 0 && (list[i].rounds || 0) > 0) out.undefeated.push(person(list[i]));
    return out;
  }

  var Awards = { empty: empty, addRound: addRound, present: present, awards: awards };
  if (typeof module !== 'undefined' && module.exports) module.exports = Awards;
  else root.Awards = Awards;
})(this);
