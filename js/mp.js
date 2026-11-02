/* כובש – משחק משפחתי אונליין: מארח-מחליט, עמית-לעמית (WebRTC) דרך PeerJS. נכתב מאפס.
   טלפון אחד "מארח" ומריץ את כל הסימולציה (כולל בוטים); האחרים שולחים רק כיוון רצוי
   ומקבלים תמונות מצב (~20 בשנייה, שטח כדלתות). שרת התיאום הציבורי של PeerJS משמש רק
   ליצירת החיבור; המשחק עצמו עובר ישירות בין הטלפונים (או דרך שרת ה-TURN הציבורי של PeerJS אם צריך).
   ספריית PeerJS (MIT) שמורה בריפו ונטענת רק כשנכנסים למשחק אונליין. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Core = window.KoveshCore;
  var PREFIX = 'kovesh-v5-', MAX_HUMANS = 6, SNAP_EVERY = 3; // 60/3 = 20 תמונות בשנייה
  var BOT_NAMES = ['שועל', 'נמר', 'ינשוף', 'דב', 'זאב', 'צבי'];
  var EXTRA_COLORS = ['#c98a96', '#8e9bb3', '#c2b48a', '#a3b8a0', '#b49fc4', '#c4a48f'];
  var ICE = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    // שרתי ה-TURN הציבוריים שמגיעים כברירת מחדל עם ספריית PeerJS (פרטי גישה ציבוריים, בלי חשבון)
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
  ];
  var ERR_NET = 'לא הצלחנו להתחבר לטלפון של המארח. נסו שכולם יהיו מחוברים לאותה רשת Wi‑Fi, ושהמארח פתוח במסך המשחק.';

  var S = Core.settings;
  var role = null;            // 'host' | 'client' | null
  var peer = null, code = '', leaving = false, overlayOn = false;
  // מארח
  var humans = [], cfg = { bots: 2, diff: 'easy', minutes: 3 }, tracker = null, inGame = false, lastRank = null;
  // לקוח
  var conn = null, lobbyState = null, myKey = '', myId = 0, throttle = null, hist = {}, offset = null, lastArrival = 0, msLeftAt = 0, connectTimer = 0;

  // ---------- טעינת PeerJS לפי דרישה ----------
  var peerLoad = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerLoad) return peerLoad;
    peerLoad = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      // ?transport=local – לבדיקות אוטומטיות בלבד (סביבה שחוסמת WebRTC)
      sc.src = /[?&]transport=local/.test(location.search) ? 'test/localpeer.js' : 'js/vendor/peerjs.min.js';
      sc.onload = function () { res(); }; sc.onerror = function () { peerLoad = null; rej(new Error('load')); };
      document.head.appendChild(sc);
    });
    return peerLoad;
  }
  function newPeer(id) {
    var opts = { config: { iceServers: ICE }, debug: /pjdebug/.test(location.search) ? 3 : 0 };
    return id ? new window.Peer(id, opts) : new window.Peer(opts);
  }
  function send(c, msg) { try { if (c && c.open) c.send(typeof msg === 'string' || msg instanceof ArrayBuffer ? msg : JSON.stringify(msg)); } catch (e) {} }
  function brokerErr(err) {
    var t = err && err.type;
    if (t === 'peer-unavailable') return 'החדר ' + code + ' לא נמצא. בדקו את הקוד, ושהמארח עדיין במסך החדר.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'אין חיבור לשרת התיאום. משחק אונליין צריך אינטרנט – בדקו את החיבור ונסו שוב.';
    if (t === 'browser-incompatible') return 'הדפדפן הזה לא תומך במשחק אונליין (WebRTC). נסו Chrome עדכני.';
    return ERR_NET;
  }

  // ---------- מסכים ----------
  function msg(id, text) { var el = $(id); if (el) el.textContent = text || ''; }
  function netMessage(title, text, withOk) {
    overlayOn = !withOk;
    $('netTitle').textContent = title; $('netText').textContent = text;
    $('netOk').classList.toggle('hidden', !withOk);
    Core.show('netmsg');
  }
  function hideOverlay() { if (overlayOn) { overlayOn = false; Core.show(null); } }
  $('netOk').onclick = function () { overlayOn = false; if (Core.state === 'play' && Core.mode !== 'solo') Core.show(null); else Core.show(role ? 'lobby' : 'online'); };

  $('onlineBtn').onclick = function () { msg('onlineMsg', ''); $('codeInput').value = ''; Core.show('online'); };
  $('onlineBack').onclick = function () { Core.show('menu'); };
  $('hostBtn').onclick = function () { startHost(); };
  $('joinBtn').onclick = function () { joinRoom($('codeInput').value); };
  $('codeInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom(this.value); });
  $('leaveBtn').onclick = function () { if (Core.mode !== 'solo') Core.toMenu(); else { leave(); Core.show('menu'); } };
  $('resultsLeave').onclick = function () { Core.toMenu(); };
  $('againRoundBtn').onclick = function () { if (role === 'host') hostStart(); };
  $('toLobbyBtn').onclick = function () { if (role === 'host') { inGame = false; Core.setState('menu'); broadcast({ t: 'tolobby' }); showLobby(); } };
  $('startBtn').onclick = function () { if (role === 'host') hostStart(); };
  $('lobbyName').addEventListener('input', function () {
    var n = Net.cleanName(this.value); S.name = n; Core.save();
    if (role === 'host') { humans[0].name = n || 'מארח'; pushLobby(); } else send(conn, { t: 'name', name: n });
  });
  function segBind(id, key, parse) {
    var el = $(id);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || role !== 'host') return;
      cfg[key] = parse ? parse(b.dataset.v) : b.dataset.v; pushLobby();
    });
  }
  segBind('mpBotsSeg', 'bots', Number); segBind('mpDiffSeg', 'diff'); segBind('mpTimeSeg', 'minutes', Number);
  $('shareBtn').onclick = function () {
    var url = shareURL(), text = 'בואו לשחק איתי כובש! קוד החדר: ' + code;
    if (navigator.share) navigator.share({ title: 'כובש – משחק משפחתי', text: text, url: url }).catch(function () {});
    else { try { navigator.clipboard.writeText(url); msg('lobbyMsg', 'הקישור הועתק'); } catch (e) {} }
  };
  function shareURL() { return location.origin + location.pathname.replace(/index\.html$/, '') + '?room=' + code; }

  function renderLobby(L) {
    var isHost = role === 'host';
    $('roomCode').textContent = code;
    $('shareLink').value = shareURL();
    $('waLink').href = 'https://wa.me/?text=' + encodeURIComponent('בואו לשחק איתי כובש! ' + shareURL());
    $('shareBox').classList.toggle('hidden', false);
    var mine = L.players.filter(function (p) { return p.key === myKey; })[0];
    if (document.activeElement !== $('lobbyName')) $('lobbyName').value = mine ? mine.name : S.name || '';
    // דמויות – תפוסות מושבתות
    var av = $('lobbyAvatars'); av.innerHTML = '';
    Avatars.list.forEach(function (a, i) {
      var owner = L.players.filter(function (p) { return p.avatar === i; })[0];
      var b = document.createElement('button');
      var img = new Image(); img.src = Avatars.dataURL(i, 72, a.color); img.alt = a.name;
      b.appendChild(img); b.appendChild(document.createTextNode(owner ? owner.name : a.name));
      if (owner && owner.key === myKey) b.classList.add('on');
      else if (owner) { b.disabled = true; b.classList.add('taken'); }
      b.onclick = function () { pickAvatar(i); };
      av.appendChild(b);
    });
    var ul = $('lobbyPlayers'); ul.innerHTML = '';
    L.players.forEach(function (p) {
      var li = document.createElement('li');
      var img = new Image(); img.src = Avatars.dataURL(p.avatar, 48, Avatars.list[p.avatar].color); img.alt = '';
      li.appendChild(img); li.appendChild(document.createTextNode(p.name + (p.host ? ' (מארח)' : '') + (p.key === myKey ? ' – את/ה' : '')));
      ul.appendChild(li);
    });
    $('lobbyCount').textContent = L.players.length + '/' + MAX_HUMANS;
    // הגדרות
    $('hostCfg').classList.toggle('readonly', !isHost);
    [['mpBotsSeg', 'bots'], ['mpDiffSeg', 'diff'], ['mpTimeSeg', 'minutes']].forEach(function (x) {
      [].forEach.call($(x[0]).children, function (b) { b.classList.toggle('on', String(L.cfg[x[1]]) === b.dataset.v); b.disabled = !isHost; });
    });
    $('startBtn').classList.toggle('hidden', !isHost);
    $('waitHost').classList.toggle('hidden', isHost);
    $('startBtn').disabled = L.players.length + L.cfg.bots < 2;
    msg('startHint', isHost ? (L.players.length + L.cfg.bots < 2 ? 'מחכים לשחקן נוסף (או בחרו בוטים)' : '') : '');
  }
  function showLobby() { Core.show('lobby'); if (role === 'host') pushLobby(); else if (lobbyState) renderLobby(lobbyState); }
  function pickAvatar(i) {
    if (role === 'host') { if (!humans.some(function (h) { return h.avatar === i && h !== humans[0]; })) { humans[0].avatar = i; S.avatar = i; Core.save(); pushLobby(); } }
    else { S.avatar = i; Core.save(); send(conn, { t: 'pick', avatar: i }); }
  }

  // ================= מארח =================
  function startHost() {
    leave(); role = 'host'; leaving = false; msg('onlineMsg', 'פותחים חדר…');
    loadPeer().then(function () { openHostPeer(0); }, function () { role = null; msg('onlineMsg', 'טעינת רכיב האונליין נכשלה. צריך אינטרנט בפעם הראשונה.'); });
  }
  function openHostPeer(tries) {
    code = Net.roomCode();
    peer = newPeer(PREFIX + code);
    peer.on('open', function () {
      myKey = 'host';
      humans = [{ key: 'host', name: Net.cleanName(S.name) || 'מארח', avatar: S.avatar % Avatars.list.length, host: true, conn: null, pid: 0 }];
      inGame = false; showLobby();
    });
    peer.on('connection', onClientConn);
    peer.on('error', function (err) {
      if (err.type === 'unavailable-id' && tries < 5) { try { peer.destroy(); } catch (e) {} openHostPeer(tries + 1); return; }
      if (role !== 'host') return;
      if (Core.state === 'play' || Core.state === 'paused') return; // תקלה בשרת התיאום לא עוצרת משחק שכבר רץ
      msg('onlineMsg', brokerErr(err)); Core.show('online'); role = null;
    });
    peer.on('disconnected', function () { if (role === 'host' && !leaving) try { peer.reconnect(); } catch (e) {} }); // נשארים זמינים להצטרפות
  }
  function lobbyView() {
    return { players: humans.map(function (h) { return { key: h.key, name: h.name, avatar: h.avatar, host: !!h.host }; }), cfg: cfg, code: code };
  }
  function pushLobby() {
    var L = lobbyView();
    humans.forEach(function (h) { if (h.conn) send(h.conn, { t: 'lobby', lobby: L, you: h.key }); });
    if ($('lobby').classList.contains('hidden') === false) renderLobby(L);
  }
  function broadcast(m) { var data = typeof m === 'string' || m instanceof ArrayBuffer ? m : JSON.stringify(m); humans.forEach(function (h) { if (h.conn && h.conn.open) try { h.conn.send(data); } catch (e) {} }); }
  function freeAvatar(want) {
    var used = humans.map(function (h) { return h.avatar; });
    if (want != null && want >= 0 && want < Avatars.list.length && used.indexOf(want) < 0) return want;
    for (var i = 0; i < Avatars.list.length; i++) if (used.indexOf(i) < 0) return i;
    return 0;
  }
  function onClientConn(c) {
    var h = null;
    c.on('data', function (d) {
      if (typeof d !== 'string') return;
      if (d.charCodeAt(0) === 105 /* i */) { // קלט: "i<זווית>"
        var g = Core.game, a = parseFloat(d.slice(1));
        if (h && h.pid && g && isFinite(a) && Core.mode === 'host') { var p = g.players[h.pid - 1]; if (p && p.alive) p.target = a; }
        return;
      }
      var m; try { m = JSON.parse(d); } catch (e) { return; }
      if (m.t === 'hello' && !h) {
        if (humans.length >= MAX_HUMANS) { send(c, { t: 'reject', why: 'החדר מלא (עד ' + MAX_HUMANS + ' שחקנים).' }); setTimeout(function () { c.close(); }, 300); return; }
        h = { key: c.peer, name: Net.cleanName(m.name) || ('שחקן ' + (humans.length + 1)), avatar: freeAvatar(m.avatar), conn: c, pid: 0 };
        humans.push(h);
        if (inGame) joinMidGame(h); else pushLobby();
      } else if (!h) return;
      else if (m.t === 'name') { h.name = Net.cleanName(m.name) || h.name; if (!inGame) pushLobby(); }
      else if (m.t === 'pick') { if (!inGame && freeAvatar(m.avatar) === m.avatar) { h.avatar = m.avatar; } pushLobby(); }
    });
    c.on('close', function () { if (h) dropHuman(h); });
    c.on('error', function () { if (h) dropHuman(h); });
  }
  function dropHuman(h) {
    var i = humans.indexOf(h); if (i < 0) return;
    humans.splice(i, 1);
    var g = Core.game;
    if (inGame && g && h.pid) {
      var p = g.players[h.pid - 1];
      if (p && !p.gone) { p.gone = true; if (p.alive) g.kill(p, null, 'left'); else { Core.feed(p.name + ' עזב/ה את המשחק'); broadcast({ t: 'ev', k: 'left', v: p.id }); } clearTerritory(g, p); }
    }
    if (!inGame) pushLobby();
  }
  function clearTerritory(g, p) { if (g.counts[p.id] > 0) for (var j = 0; j < g.owner.length; j++) if (g.owner[j] === p.id) g.setOwner(j, 0); }
  function roster(g) { return g.players.map(function (p) { return { name: p.name, avatar: p.avatar, color: p.color, isBot: p.isBot, gone: !!p.gone }; }); }
  function hostStart() {
    var used = humans.map(function (h) { return h.avatar; }), free = [];
    for (var i = 0; i < Avatars.list.length; i++) if (used.indexOf(i) < 0) free.push(i);
    var list = humans.map(function (h) { return { name: h.name, avatar: h.avatar, color: Avatars.list[h.avatar].color, isBot: false }; });
    var extra = EXTRA_COLORS.slice();
    for (var b = 0; b < cfg.bots; b++) {
      var av = free.length ? free[b % free.length] : b % Avatars.list.length;
      list.push({ name: BOT_NAMES[b] + ' 🤖', avatar: av, color: b < free.length ? Avatars.list[av].color : extra.shift(), isBot: true });
    }
    humans.forEach(function (h, k) { h.pid = k + 1; });
    var size = list.length <= 3 ? 80 : list.length <= 7 ? 100 : 130;    // מפה לפי מספר המשתתפים
    var roundMs = cfg.minutes * 60000;
    var g = Core.startMatch({ mode: 'host', size: size, roster: list, myId: 1, diff: cfg.diff, roundMs: roundMs });
    tracker = new Net.Tracker(g); inGame = true; lastRank = null;
    humans.forEach(function (h) { if (h.conn) send(h.conn, { t: 'start', size: size, roster: roster(g), you: h.pid, roundMs: roundMs, diff: cfg.diff }); });
    broadcast(Net.encodeSnap(g, tracker, roundMs, false));
  }
  function joinMidGame(h) {
    var g = Core.game; if (!g) return;
    var p = Core.addMatchPlayer({ name: h.name, avatar: h.avatar, color: Avatars.list[h.avatar].color, isBot: false }, true);
    h.pid = p.id;
    humans.forEach(function (o) { if (o.conn && o !== h) send(o.conn, { t: 'roster', roster: roster(g) }); });
    send(h.conn, { t: 'start', size: g.W, roster: roster(g), you: h.pid, roundMs: Core.match.roundMs, diff: cfg.diff, mid: true });
    send(h.conn, Net.encodeSnap(g, new Net.Tracker(g), Core.match.msLeft, Core.state === 'paused'));
    if (Core.state === 'paused') send(h.conn, { t: 'pause', why: 'bg' });
    Core.feed(h.name + ' הצטרף/ה');
    if (Core.state === 'results') send(h.conn, { t: 'results', rank: lastRank });
  }
  var hooks = {
    onTick: function () {
      var g = Core.game;
      if (!tracker || !g || g.tickNo % SNAP_EVERY) return;
      if (humans.length > 1) broadcast(Net.encodeSnap(g, tracker, Core.match.msLeft, false));
      else Net.encodeSnap(g, tracker, 0, false); // שומרים את המעקב מעודכן גם בלי לקוחות
    },
    onEvent: function (ev) {
      if (ev.type === 'death') broadcast({ t: 'ev', k: 'death', v: ev.victim.id, by: ev.killer ? ev.killer.id : 0, r: ev.reason });
    },
    roundOver: function () {
      var g = Core.game; lastRank = Net.ranking(g);
      Core.endRound();
      broadcast(Net.encodeSnap(g, tracker, 0, false));
      broadcast({ t: 'results', rank: lastRank });
      showResults(lastRank);
    },
    onPause: function (why) { broadcast({ t: 'pause', why: why }); },
    onResume: function () { broadcast({ t: 'resume' }); },
    onSteer: function (a) { if (throttle) throttle.push(a, performance.now()); },
    clientFrame: clientFrame,
    overlay: function () { return overlayOn; },
    leave: function () { leave(); }
  };
  Core.attach(hooks);

  function showResults(rank) {
    var ol = $('rankList'); ol.innerHTML = '';
    var myPid = role === 'host' ? 1 : myId;
    (rank || []).forEach(function (r, i) {
      var li = document.createElement('li');
      var img = new Image(); img.src = Avatars.dataURL(r.avatar, 48, r.color); img.alt = '';
      var medal = ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
      li.appendChild(document.createTextNode(medal + ' ')); li.appendChild(img);
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name; li.appendChild(nm);
      var st = document.createElement('span'); st.className = 'p'; st.textContent = r.pct.toFixed(1) + '% · ⚔️' + r.kills; li.appendChild(st);
      if (r.id === myPid) li.classList.add('me');
      ol.appendChild(li);
    });
    var isHost = role === 'host';
    $('againRoundBtn').classList.toggle('hidden', !isHost); $('toLobbyBtn').classList.toggle('hidden', !isHost);
    $('resultsWait').classList.toggle('hidden', isHost);
    Core.show('results');
  }

  // ================= לקוח =================
  function joinRoom(raw) {
    var c = Net.cleanCode(raw);
    if (!Net.validCode(c)) { msg('onlineMsg', 'קוד חדר הוא 4 אותיות/ספרות'); return; }
    leave(); role = 'client'; leaving = false; code = c; msg('onlineMsg', 'מתחברים לחדר ' + c + '…'); Core.show('online');
    loadPeer().then(function () {
      peer = newPeer();
      peer.on('open', function (id) {
        myKey = id;
        conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
        clearTimeout(connectTimer);
        connectTimer = setTimeout(function () { if (role === 'client' && !(conn && conn.open)) { failClient(ERR_NET); } }, 20000);
        conn.on('open', function () { clearTimeout(connectTimer); send(conn, { t: 'hello', name: Net.cleanName(S.name), avatar: S.avatar, v: 5 }); msg('onlineMsg', 'מחובר! מחכים ללובי…'); });
        conn.on('data', onHostData);
        conn.on('close', function () { if (!leaving && role === 'client') hostGone(); });
        conn.on('error', function () { if (!leaving && role === 'client' && !conn.open) failClient(ERR_NET); });
        conn.on('iceStateChanged', function (st) { if (st === 'failed' && role === 'client') failClient(ERR_NET); });
      });
      peer.on('error', function (err) { if (role === 'client' && !leaving) failClient(brokerErr(err)); });
    }, function () { role = null; msg('onlineMsg', 'טעינת רכיב האונליין נכשלה. צריך אינטרנט.'); });
  }
  function failClient(text) {
    var inMatch = Core.mode === 'client';
    leave();
    if (inMatch) { Core.toMenu(); }
    msg('onlineMsg', text); Core.show('online');
  }
  function hostGone() {
    var inMatch = Core.mode === 'client';
    leave();
    if (inMatch) Core.toMenu();
    netMessage('המארח עזב', 'החיבור למארח נסגר (המארח יצא מהמשחק או שהאינטרנט נותק). אפשר להצטרף שוב עם אותו קוד כשהמארח יפתח חדר.', true);
  }
  function onHostData(d) {
    if (d instanceof ArrayBuffer || ArrayBuffer.isView(d) || (d && d.byteLength != null && typeof d !== 'string')) {
      var g = Core.game; if (Core.mode !== 'client' || !g) return;
      var buf = d instanceof ArrayBuffer ? d : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
      var st = Net.decodeSnap(buf, g); if (!st) return;
      var now = performance.now(), ht = st.tick * Core.TICK_MS;
      var off = now - ht;
      offset = offset == null ? off : Math.min(off, offset + 2); // הערכת השעון של המארח (הדגימה המהירה ביותר, עם סחף איטי)
      lastArrival = now;
      Core.match.msLeft = st.msLeft; msLeftAt = now;
      st.players.forEach(function (ps) {
        var p = g.players[ps.id - 1]; if (!p) return;
        p.kills = ps.kills; p.gone = ps.gone;
        var hs = hist[ps.id] || (hist[ps.id] = []);
        if (!ps.alive) { p.alive = false; hs.length = 0; return; }
        if (!p.alive) { hs.length = 0; p.alive = true; p.x = ps.x; p.y = ps.y; p.h = p.target = ps.h; }
        hs.push({ t: ht, x: ps.x, y: ps.y, h: ps.h });
        if (hs.length > 8) hs.shift();
      });
      if (st.paused) return;
      return;
    }
    if (typeof d !== 'string') return;
    var m; try { m = JSON.parse(d); } catch (e) { return; }
    if (m.t === 'lobby') {
      lobbyState = m.lobby; myKey = m.you;
      var inMatch = Core.mode === 'client' && (Core.state === 'play' || Core.state === 'paused' || Core.state === 'results');
      if (!inMatch) { if ($('lobby').classList.contains('hidden')) Core.show('lobby'); renderLobby(lobbyState); }
    }
    else if (m.t === 'bye') { if (!leaving) hostGone(); }
    else if (m.t === 'reject') { failClient(m.why); }
    else if (m.t === 'start') {
      hist = {}; offset = null; myId = m.you; overlayOn = false;
      throttle = new Net.InputThrottle(function (a) { send(conn, 'i' + a.toFixed(3)); }, 33, 0.01);
      Core.startMatch({ mode: 'client', size: m.size, roster: m.roster, myId: m.you, diff: m.diff, roundMs: m.roundMs });
      m.roster.forEach(function (r, i) { if (r.gone) Core.game.players[i].gone = true; });
    }
    else if (m.t === 'roster') {
      var g = Core.game; if (!g) return;
      for (var i = g.players.length; i < m.roster.length; i++) Core.addMatchPlayer(m.roster[i], false);
    }
    else if (m.t === 'ev') {
      var g2 = Core.game; if (!g2) return;
      var v = g2.players[m.v - 1]; if (!v) return;
      if (m.k === 'left') { Core.feed(v.name + ' עזב/ה את המשחק'); return; }
      var by = m.by ? g2.players[m.by - 1] : null;
      Core.effect(v.x, v.y, v.color);
      if (m.r === 'left') { Core.feed(v.name + ' עזב/ה את המשחק'); v.gone = true; return; }
      if (v === Core.me) Core.myDeath({ reason: m.r, killer: by });
      else if (by === Core.me) Core.feed('הבסת את ' + v.name + '! ⚔️');
      else if (by) Core.feed(by.name + ' הביס את ' + v.name);
    }
    else if (m.t === 'pause') { if (Core.mode === 'client') netMessage('המשחק מושהה', m.why === 'bg' ? 'המארח יצא מהאפליקציה – המשחק מושהה עד שיחזור.' : 'המארח השהה את המשחק.', false); }
    else if (m.t === 'resume') { hideOverlay(); }
    else if (m.t === 'results') { overlayOn = false; Core.endRound(); showResults(m.rank); }
    else if (m.t === 'tolobby') { Core.setState('menu'); Core.stopLoop(); Core.show('lobby'); if (lobbyState) renderLobby(lobbyState); }
  }
  /* אינטרפולציה: מציירים ~70ms "מאחורי" המארח, בין שתי תמונות המצב שמקיפות את הרגע הזה */
  function clientFrame(now) {
    var g = Core.game; if (!g) return;
    if (throttle) throttle.flush(now);
    if (msLeftAt) Core.match.msLeft = Math.max(0, Core.match.msLeft - (now - msLeftAt)), msLeftAt = now;
    if (offset == null) return;
    var rt = now - offset - 70;
    for (var k = 0; k < g.players.length; k++) {
      var p = g.players[k], hs = hist[p.id];
      if (!p.alive || !hs || !hs.length) continue;
      var a = hs[0], b = null;
      for (var i = 0; i < hs.length; i++) { if (hs[i].t <= rt) a = hs[i]; else { b = hs[i]; break; } }
      var x, y, h;
      if (b && b !== a && rt >= a.t) {
        var f = (rt - a.t) / (b.t - a.t);
        x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f; h = a.h + Game.angDiff(b.h, a.h) * f;
      } else if (!b) {   // תמונה מאחרת: ממשיכים קדימה לפי הכיוון, לכל היותר 120ms
        var e = Math.min(120, rt - a.t) / 1000;
        x = a.x + Math.cos(a.h) * g.SPEED * e; y = a.y + Math.sin(a.h) * g.SPEED * e; h = a.h;
      } else { x = a.x; y = a.y; h = a.h; }
      p.x = x; p.y = y; p.h = h;
      if (p !== Core.me) p.target = h;
      else p.target = h;            // התצוגה לא מקדימה את המארח (בלי קפיצות)
    }
  }

  // ---------- יציאה ----------
  function leave() {
    leaving = true; clearTimeout(connectTimer);
    if (role === 'host') { broadcast({ t: 'bye' }); humans.forEach(function (h) { try { h.conn && h.conn.close(); } catch (e) {} }); }
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; conn = null; role = null; humans = []; inGame = false; tracker = null; throttle = null; lobbyState = null; hist = {};
  }
  window.addEventListener('pagehide', function (e) { if (!e.persisted && role) { try { if (peer) peer.destroy(); } catch (x) {} } });

  // קישור שיתוף: ?room=XXXX => ישר להצטרפות
  var q = Net.cleanCode(new URLSearchParams(location.search).get('room'));
  if (Net.validCode(q)) setTimeout(function () { joinRoom(q); }, 0);

  window.__koveshNet = { setCfg: function (o) { Object.assign(cfg, o); if (role === 'host') pushLobby(); }, get role() { return role; }, get code() { return code; }, get humans() { return humans.length; }, get lobby() { return lobbyState; }, get myId() { return myId; } };
})();
