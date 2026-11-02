/* כובש – פרוטוקול רשת למשחק משפחתי (טהור, ללא DOM, נבדק ב-node). נכתב מאפס.
   תמונת מצב בינארית קומפקטית (~20 בשנייה) מהמארח ללקוחות:
     u8 סוג(1) · u32 צעד · u32 זמן-שנותר(ms) · u8 דגלים(1=מושהה) · u8 מס' שחקנים
     לכל שחקן: u8 id · u8 דגלים(1=חי,2=עזב) · u16 x·100 · u16 y·100 · i16 כיוון·10000 · u16 הריגות
               u16 התחלת-שובל · u16 מס' נקודות חדשות · נקודות (u16,u16)·100
     שטח: רצפים של [דילוג varint · אורך varint · בעלים u8] – רק תאים שהשתנו מאז התמונה הקודמת.
   הצטרפות: אותו פורמט עם tracker ריק => כל הרשת וכל השובלים. */
(function (root) {
  'use strict';
  var Q = 100, HQ = 10000;

  function Writer(cap) { this.buf = new ArrayBuffer(cap || 1024); this.dv = new DataView(this.buf); this.o = 0; }
  Writer.prototype.need = function (n) {
    if (this.o + n <= this.buf.byteLength) return;
    var nb = new ArrayBuffer(Math.max(this.buf.byteLength * 2, this.o + n + 256));
    new Uint8Array(nb).set(new Uint8Array(this.buf, 0, this.o)); this.buf = nb; this.dv = new DataView(nb);
  };
  Writer.prototype.u8 = function (v) { this.need(1); this.dv.setUint8(this.o, v); this.o += 1; };
  Writer.prototype.u16 = function (v) { this.need(2); this.dv.setUint16(this.o, v); this.o += 2; };
  Writer.prototype.i16 = function (v) { this.need(2); this.dv.setInt16(this.o, v); this.o += 2; };
  Writer.prototype.u32 = function (v) { this.need(4); this.dv.setUint32(this.o, v >>> 0); this.o += 4; };
  Writer.prototype.vu = function (v) { while (v >= 128) { this.u8((v & 127) | 128); v = Math.floor(v / 128); } this.u8(v); };
  Writer.prototype.done = function () { return this.buf.slice(0, this.o); };

  function Reader(buf) { this.dv = new DataView(buf); this.o = 0; this.n = buf.byteLength; }
  Reader.prototype.u8 = function () { var v = this.dv.getUint8(this.o); this.o += 1; return v; };
  Reader.prototype.u16 = function () { var v = this.dv.getUint16(this.o); this.o += 2; return v; };
  Reader.prototype.i16 = function () { var v = this.dv.getInt16(this.o); this.o += 2; return v; };
  Reader.prototype.u32 = function () { var v = this.dv.getUint32(this.o); this.o += 4; return v; };
  Reader.prototype.vu = function () { var v = 0, m = 1, b; do { b = this.u8(); v += (b & 127) * m; m *= 128; } while (b & 128); return v; };

  function q(v) { v = Math.round(v * Q); return v < 0 ? 0 : v > 65535 ? 65535 : v; }

  /* מעקב של המארח: מה כבר נשלח (עותק צל של הרשת + אורך שובל לכל שחקן) */
  function Tracker(game) { this.shadow = new Uint8Array(game.owner.length); this.sent = {}; }

  function encodeSnap(g, tr, msLeft, paused) {
    var w = new Writer(512), ps = g.players, i, k;
    w.u8(1); w.u32(g.tickNo); w.u32(Math.max(0, Math.round(msLeft || 0))); w.u8(paused ? 1 : 0); w.u8(ps.length);
    for (k = 0; k < ps.length; k++) {
      var p = ps[k], t = p.trail, L = t.length / 2, s = tr.sent[p.id] || (tr.sent[p.id] = { len: 0, fx: 0, fy: 0 });
      w.u8(p.id); w.u8((p.alive ? 1 : 0) | (p.gone ? 2 : 0));
      w.u16(q(g.wrap(p.x))); w.u16(q(g.wrap(p.y))); w.i16(Math.round(p.h * HQ)); w.u16(Math.min(65535, p.kills));
      var start = (L > 0 && s.len > 0 && L >= s.len && t[0] === s.fx && t[1] === s.fy) ? s.len : 0;
      if (!p.alive) { start = 0; L = 0; }
      w.u16(start); w.u16(L - start);
      // טורוס: נקודות השובל נשלחות עטופות ל-[0,W) (ה-u16 לא מקבל שליליים); הלקוח פורש מחדש
      for (i = start; i < L; i++) { w.u16(q(g.wrap(t[2 * i]))); w.u16(q(g.wrap(t[2 * i + 1]))); }
      s.len = L; s.fx = L ? t[0] : 0; s.fy = L ? t[1] : 0;
    }
    // שטח: רק מה שהשתנה
    var o = g.owner, sh = tr.shadow, n = o.length, last = 0;
    i = 0;
    while (i < n) {
      if (o[i] === sh[i]) { i++; continue; }
      var v = o[i], j = i;
      while (j < n && o[j] === v && o[j] !== sh[j]) { sh[j] = v; j++; }
      w.vu(i - last); w.vu(j - i); w.u8(v);
      last = j; i = j;
    }
    return w.done();
  }

  /* מחיל תמונת מצב על משחק "מראה" אצל הלקוח. מחזיר { tick, msLeft, paused, players:[{id,alive,gone,x,y,h,kills}] } */
  function decodeSnap(buf, g) {
    var r = new Reader(buf);
    if (r.u8() !== 1) return null;
    var out = { tick: r.u32(), msLeft: r.u32(), paused: !!(r.u8() & 1), players: [] };
    var np = r.u8();
    for (var k = 0; k < np; k++) {
      var id = r.u8(), fl = r.u8(), st = { id: id, alive: !!(fl & 1), gone: !!(fl & 2), x: r.u16() / Q, y: r.u16() / Q, h: r.i16() / HQ, kills: r.u16() };
      var start = r.u16(), cnt = r.u16(), p = g.players[id - 1];
      var pts = p ? p.trail : [];
      if (p) { if (pts.length > start * 2) pts.length = start * 2; else while (pts.length < start * 2) pts.push(st.x, st.y); }
      for (var i = 0; i < cnt; i++) {
        var x = r.u16() / Q, y = r.u16() / Q;
        if (!p) continue;
        var n2 = pts.length;   // פרישה מחדש: כל נקודה קרובה לקודמת, כמו אצל המארח (עד כדי כפולה של W)
        if (n2) { x = pts[n2 - 2] + g.wd(x - pts[n2 - 2]); y = pts[n2 - 1] + g.wd(y - pts[n2 - 1]); }
        pts.push(x, y);
      }
      out.players.push(st);
    }
    var pos = 0, o = g.owner;
    while (r.o < r.n) {
      pos += r.vu(); var len = r.vu(), v = r.u8();
      for (var c = pos; c < pos + len; c++) if (o[c] !== v) g.setOwner(c, v);
      pos += len;
    }
    return out;
  }

  /* קודי חדר: 4 תווים בלי תווים מבלבלים (O/0, I/1/L) */
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function roomCode(rand) { rand = rand || Math.random; var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(rand() * ALPHA.length)]; return s; }
  function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
  function validCode(s) { return /^[A-Z0-9]{4,6}$/.test(s); }
  function cleanName(s) { return String(s || '').replace(/[<>&"\u0000-\u001f]/g, '').trim().slice(0, 12); }

  /* שליחת קלט רק בשינוי, עם הגבלת קצב (ברירת מחדל 33ms) ושליחה מאוחרת של הערך האחרון */
  function InputThrottle(send, minMs, minDelta) {
    this.send = send; this.minMs = minMs || 33; this.minDelta = minDelta || 0.01; this.lastSent = null; this.lastT = -1e9; this.pending = null; this.timer = null;
  }
  InputThrottle.prototype.push = function (a, now) {
    if (this.lastSent != null && Math.abs(Math.atan2(Math.sin(a - this.lastSent), Math.cos(a - this.lastSent))) < this.minDelta) { this.pending = null; return false; }
    if (now - this.lastT >= this.minMs) { this.lastSent = a; this.lastT = now; this.pending = null; this.send(a); return true; }
    this.pending = a; return false;
  };
  InputThrottle.prototype.flush = function (now) {
    if (this.pending != null && now - this.lastT >= this.minMs) { var a = this.pending; this.pending = null; this.lastSent = a; this.lastT = now; this.send(a); return true; }
    return false;
  };

  /* דירוג סוף סיבוב: לפי שטח, ואז הריגות */
  function ranking(g) {
    return g.players.filter(function (p) { return !p.gone; }).map(function (p) {
      return { id: p.id, name: p.name, emoji: p.emoji, avatar: p.avatar, color: p.color, isBot: p.isBot, pct: +g.pct(p).toFixed(1), best: +p.bestPct.toFixed(1), kills: p.kills };
    }).sort(function (a, b) { return b.pct - a.pct || b.kills - a.kills || b.best - a.best; });
  }

  /* אינטרפולציה על טורוס: מ-a ל-b לאורך ההפרש הקצר, התוצאה עטופה ל-[0,W) */
  function lerpWrap(a, b, f, W) {
    var d = (b - a) % W; if (d > W / 2) d -= W; else if (d < -W / 2) d += W;
    var v = (a + d * f) % W; return v < 0 ? v + W : v;
  }

  var Net = { lerpWrap: lerpWrap, encodeSnap: encodeSnap, decodeSnap: decodeSnap, Tracker: Tracker, roomCode: roomCode, cleanCode: cleanCode, validCode: validCode, cleanName: cleanName, InputThrottle: InputThrottle, ranking: ranking, Q: Q };
  if (typeof module !== 'undefined' && module.exports) module.exports = Net;
  else root.Net = Net;
})(this);
