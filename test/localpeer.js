/* לבדיקות בלבד: תחליף ל-PeerJS עם אותו ממשק (Peer/DataConnection) מעל BroadcastChannel,
   בין דפים באותו דפדפן. משמש כשהסביבה חוסמת WebRTC (בקופסת הבדיקות: מדיניות Chrome
   disable_non_proxied_udp). כל קוד המשחק, הלובי והסנכרון רץ כרגיל – רק "הצינור" מוחלף. */
(function () {
  'use strict';
  var bc = new BroadcastChannel('kovesh-localpeer');
  var peers = {};
  function Emitter() { this._h = {}; }
  Emitter.prototype.on = function (e, f) { (this._h[e] = this._h[e] || []).push(f); return this; };
  Emitter.prototype.emit = function (e) { var a = [].slice.call(arguments, 1); (this._h[e] || []).slice().forEach(function (f) { try { f.apply(null, a); } catch (x) { setTimeout(function () { throw x; }); } }); };
  function rid() { return Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36); }

  function Conn(peer, remote, cid) { Emitter.call(this); this.peer = remote; this._local = peer; this.cid = cid; this.open = false; this.seen = Date.now(); }
  Conn.prototype = Object.create(Emitter.prototype);
  Conn.prototype.send = function (d) { if (this.open) bc.postMessage({ k: 'data', to: this.peer, from: this._local.id, cid: this.cid, d: d }); };
  Conn.prototype.close = function () { if (this._closed) return; this._closed = true; this.open = false; bc.postMessage({ k: 'close', to: this.peer, cid: this.cid }); delete this._local.conns[this.cid]; this.emit('close'); };
  Conn.prototype._drop = function () { if (this._closed) return; this._closed = true; this.open = false; delete this._local.conns[this.cid]; this.emit('close'); };

  function Peer(id) {
    Emitter.call(this);
    if (id && typeof id === 'object') id = null;
    this.id = id || rid(); this.conns = {}; this.destroyed = false;
    var self = this;
    if (peers[this.id]) { setTimeout(function () { self.emit('error', { type: 'unavailable-id' }); }); return; }
    peers[this.id] = this;
    this._ping = setInterval(function () { bc.postMessage({ k: 'ping', from: self.id }); var now = Date.now();
      Object.keys(self.conns).forEach(function (c) { if (now - self.conns[c].seen > 2500) self.conns[c]._drop(); }); }, 400);
    setTimeout(function () { self.emit('open', self.id); }, 30);
  }
  Peer.prototype = Object.create(Emitter.prototype);
  Peer.prototype.connect = function (to) {
    var c = new Conn(this, to, rid()), self = this; this.conns[c.cid] = c;
    bc.postMessage({ k: 'connect', to: to, from: this.id, cid: c.cid });
    c._t = setTimeout(function () { if (!c.open) { delete self.conns[c.cid]; self.emit('error', { type: 'peer-unavailable' }); } }, 2000);
    return c;
  };
  Peer.prototype.destroy = function () {
    if (this.destroyed) return; this.destroyed = true; clearInterval(this._ping);
    var self = this; Object.keys(this.conns).forEach(function (k) { self.conns[k].close(); });
    delete peers[this.id];
  };
  Peer.prototype.reconnect = function () {};
  bc.onmessage = function (ev) {
    var m = ev.data;
    if (m.k === 'ping') { Object.keys(peers).forEach(function (id) { var p = peers[id]; Object.keys(p.conns).forEach(function (c) { if (p.conns[c].peer === m.from) p.conns[c].seen = Date.now(); }); }); return; }
    var p = peers[m.to]; if (!p || p.destroyed) return;
    if (m.k === 'connect') {
      var c = new Conn(p, m.from, m.cid); p.conns[m.cid] = c; c.open = true;
      bc.postMessage({ k: 'accept', to: m.from, cid: m.cid });
      p.emit('connection', c); setTimeout(function () { c.emit('open'); });
    } else if (m.k === 'accept') { var a = p.conns[m.cid]; if (a) { clearTimeout(a._t); a.open = true; a.seen = Date.now(); a.emit('open'); } }
    else if (m.k === 'data') { var d = p.conns[m.cid]; if (d) { d.seen = Date.now(); d.emit('data', m.d); } }
    else if (m.k === 'close') { var x = p.conns[m.cid]; if (x) x._drop(); }
  };
  window.addEventListener('pagehide', function () { Object.keys(peers).forEach(function (id) { peers[id].destroy(); }); });
  window.Peer = Peer;
})();
