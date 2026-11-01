/* כובש – ממשק, ציור, קלט ולולאת משחק. נכתב מאפס. */
(function () {
  'use strict';
  // המשחק לא צריך שום רכיב חיצוני: מבטלים וידג'ט תגובות שהאחסון מזריק לדף (בלי רשת, בלי מעקב)
  window.__flypodCommentsLoaded = true;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- הגדרות ושיאים ----------
  var DEFAULTS = { name: '', avatar: 0, diff: 'normal', bots: 6, size: 100, fps: 30, dpr: 2, joy: false, mini: true, vib: true };
  var S = load('kovesh.settings', DEFAULTS);
  var BEST = load('kovesh.best', { pct: 0, kills: 0 });
  function load(k, def) {
    try { var v = JSON.parse(localStorage.getItem(k)); return Object.assign({}, def, v || {}); } catch (e) { return Object.assign({}, def); }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var EXTRA_COLORS = ['#b04be8', '#00b3a4', '#8d6e63'];
  var BOT_NAMES = ['שועל', 'נמר', 'ינשוף', 'דב', 'זאב', 'צבי', 'נשר', 'תנין', 'פנתר', 'דולפין'];
  var TICK_MS = 50;               // 20 צעדי לוגיקה בשנייה (קבוע)
  var RESPAWN_TICKS = 60;         // ~3 שניות
  var VIEW_UNITS = 24;            // כמה יחידות עולם רואים לאורך הצלע הקצרה

  // ---------- מצב ----------
  var canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  var mini = $('minimap'), mctx = mini.getContext('2d');
  var g = null, me = null, state = 'menu';
  var W = 0, H = 0, DPR = 1, unitPx = 20;
  var rafId = 0, lastFrame = 0, acc = 0, lastHud = 0;
  var paths = [], layer = null, layerCtx = null, layerX = 0, layerY = 0, dirtyWorld = null;
  var mm = null, mmCtx = null, mmImg = null, mmData = null, mmDirty = false;
  var rgb = [], trailCss = [], darkCss = [], fillCss = [], lineCss = [];
  var camX = 0, camY = 0, effects = [], avatarURLs = [], lastBoardKey = '', startBest = { pct: 0, kills: 0 }, keysHeld = {};

  // ---------- תפריט ----------
  function seg(id, key, parse) {
    var el = $(id);
    function paint() { [].forEach.call(el.children, function (b) { b.classList.toggle('on', String(S[key]) === b.dataset.v); }); }
    el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S[key] = parse ? parse(b.dataset.v) : b.dataset.v; paint(); save('kovesh.settings', S); });
    paint();
  }
  seg('diffSeg', 'diff'); seg('botsSeg', 'bots', Number); seg('sizeSeg', 'size', Number); seg('fpsSeg', 'fps', Number); seg('dprSeg', 'dpr', Number);
  $('nameInput').value = S.name;
  $('joyChk').checked = S.joy; $('miniChk').checked = S.mini; $('vibChk').checked = S.vib;

  function buildAvatarPick() {
    var el = $('avatarPick'); el.innerHTML = '';
    Avatars.list.forEach(function (a, i) {
      var b = document.createElement('button');
      var img = new Image(); img.src = Avatars.dataURL(i, 96, a.color); img.alt = a.name;
      b.appendChild(img); b.appendChild(document.createTextNode(a.name));
      if (i === S.avatar) b.classList.add('on');
      b.addEventListener('click', function () { S.avatar = i; save('kovesh.settings', S); buildAvatarPick(); });
      el.appendChild(b);
    });
  }
  buildAvatarPick();
  function showBest() {
    var t = 'שיא: ' + BEST.pct.toFixed(1) + '% שטח · ' + BEST.kills + ' הריגות';
    $('best').textContent = t; $('overBest').textContent = t;
  }
  showBest();

  function show(id) {
    ['menu', 'settings', 'help', 'paused', 'over'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
  }
  $('playBtn').onclick = startGame;
  $('settingsBtn').onclick = function () { show('settings'); };
  $('helpBtn').onclick = function () { show('help'); };
  $('helpBack').onclick = function () { show('menu'); };
  $('settingsBack').onclick = function () {
    S.joy = $('joyChk').checked; S.mini = $('miniChk').checked; S.vib = $('vibChk').checked;
    save('kovesh.settings', S); show('menu');
  };
  $('resetBest').onclick = function () { if (confirm('לאפס את השיאים?')) { BEST = { pct: 0, kills: 0 }; save('kovesh.best', BEST); showBest(); } };
  $('nameInput').addEventListener('change', function () { S.name = this.value.trim(); save('kovesh.settings', S); });
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = toMenu;
  $('againBtn').onclick = startGame;
  $('menuBtn').onclick = toMenu;
  $('pauseBtn').addEventListener('pointerdown', function (e) { e.stopPropagation(); pause(); });

  // התקנה כאפליקציה
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; $('installBtn').classList.remove('hidden'); });
  $('installBtn').onclick = function () { if (installEvt) { installEvt.prompt(); installEvt = null; $('installBtn').classList.add('hidden'); } };

  // ---------- התחלת משחק ----------
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(c, d, t) { return [Math.round(c[0] + (d[0] - c[0]) * t), Math.round(c[1] + (d[1] - c[1]) * t), Math.round(c[2] + (d[2] - c[2]) * t)]; }
  function css(c, a) { return a == null ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function startGame() {
    S.name = $('nameInput').value.trim(); save('kovesh.settings', S);
    g = new Game({ size: S.size });
    startBest = { pct: BEST.pct, kills: BEST.kills };
    var myAv = S.avatar % Avatars.list.length, myCol = Avatars.list[myAv].color;
    me = g.addPlayer({ name: S.name || 'אני', avatar: myAv, color: myCol });
    var freeAv = []; for (var i = 0; i < Avatars.list.length; i++) if (i !== myAv) freeAv.push(i);
    shuffle(freeAv);
    var names = BOT_NAMES.slice(); shuffle(names);
    var extra = EXTRA_COLORS.slice();
    for (var b = 0; b < S.bots; b++) {
      var av = freeAv[b % freeAv.length];
      // דמות שחוזרת פעמיים מקבלת צבע אחר
      var col = b < freeAv.length ? Avatars.list[av].color : extra.shift();
      g.addPlayer({ name: names[b], isBot: true, avatar: av, color: col });
    }
    rgb = [[0, 0, 0]]; trailCss = ['']; darkCss = ['']; fillCss = ['']; lineCss = [''];
    avatarURLs = [null];
    g.players.forEach(function (p) {
      var c = hexRgb(p.color);
      rgb[p.id] = c; fillCss[p.id] = css(mix(c, [255, 255, 255], 0.08));
      trailCss[p.id] = css(mix(c, [255, 255, 255], 0.35), 0.85);
      darkCss[p.id] = css(mix(c, [0, 0, 0], 0.38)); lineCss[p.id] = css(mix(c, [0, 0, 0], 0.22));
      avatarURLs[p.id] = Avatars.dataURL(p.avatar, 64, p.color);
      p.blinkAt = performance.now() + 1000 + Math.random() * 3000;
    });
    g.spawn(me, { x: g.W / 2, y: g.W / 2 });
    for (var k = 1; k < g.players.length; k++) g.spawn(g.players[k]);
    paths = [];
    setupMinimap();
    effects = []; camX = me.x; camY = me.y;
    $('hudAvatar').src = avatarURLs[me.id];
    $('feed').innerHTML = ''; lastBoardKey = '';
    $('minimap').classList.toggle('hidden', !S.mini);
    resize();
    show(null); $('hud').classList.remove('hidden');
    joySetup(); keysHeld = {};
    state = 'play'; acc = 0; lastFrame = 0;
    updateHud(true);
    startLoop();
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // מפה קטנה: תמונה ברזולוציית הרשת, מתעדכנת רק בתאים שהשתנו
  function setupMinimap() {
    var G = g.G;
    mm = document.createElement('canvas'); mm.width = mm.height = G; mmCtx = mm.getContext('2d');
    mmImg = mmCtx.createImageData(G, G); mmData = mmImg.data;
    for (var i = 0, n = G * G; i < n; i++) mmPaint(i);
    mmCtx.putImageData(mmImg, 0, 0);
    g.dirtyCells.length = 0;
  }
  function mmPaint(i) {
    var o = i * 4, w = g.owner[i];
    if (w) { var c = rgb[w]; mmData[o] = c[0]; mmData[o + 1] = c[1]; mmData[o + 2] = c[2]; mmData[o + 3] = 255; }
    else mmData[o + 3] = 0;
  }

  // עדכון צורות השטח – רק לשחקנים שהשטח שלהם השתנה
  function flushTerrain() {
    var changed = false;
    for (var id = 1; id <= g.players.length; id++) {
      if (!g.dirtyOwners[id]) continue;
      g.dirtyOwners[id] = 0; changed = true;
      paths[id] = g.counts[id] > 0 ? Terrain.toPath(Terrain.contours(g.owner, g.G, g.CELL, id)) : null;
    }
    if (g.dirtyCells.length) {
      for (var k = 0; k < g.dirtyCells.length; k++) mmPaint(g.dirtyCells[k]);
      g.dirtyCells.length = 0; mmDirty = true;
    }
    if (changed && g.dirtyBox) {
      var b = g.dirtyBox, C = g.CELL;
      // אזור מלוכלך ביחידות עולם (עם שוליים להחלקה, צל וקו מתאר)
      var r = [b[0] * C - 2, b[1] * C - 2, (b[2] + 1) * C + 2, (b[3] + 1) * C + 2];
      dirtyWorld = dirtyWorld ? [Math.min(dirtyWorld[0], r[0]), Math.min(dirtyWorld[1], r[1]), Math.max(dirtyWorld[2], r[2]), Math.max(dirtyWorld[3], r[3])] : r;
    }
    g.dirtyBox = null;
  }

  // ---------- לולאה ----------
  function startLoop() { if (!rafId) { lastFrame = 0; rafId = requestAnimationFrame(frame); } }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
  function frame(now) {
    rafId = 0;
    if (state !== 'play' && state !== 'dying') return;      // אין עבודה ברקע בתפריטים
    rafId = requestAnimationFrame(frame);
    var interval = 1000 / S.fps;
    if (lastFrame && now - lastFrame < interval - 2) return;  // מגבלת פריימים
    var dt = lastFrame ? Math.min(250, now - lastFrame) : 0;
    lastFrame = now;
    acc += dt;
    var ticks = 0;
    while (acc >= TICK_MS && ticks < 6) { tick(); acc -= TICK_MS; ticks++; }
    if (ticks) flushTerrain();
    render(Math.min(1, acc / TICK_MS), now);
    if (now - lastHud > 400) { lastHud = now; updateHud(false); }
  }

  function tick() {
    var ps = g.players;
    // מקלדת
    if (me.alive) {
      var vx = (keysHeld.ArrowRight ? 1 : 0) - (keysHeld.ArrowLeft ? 1 : 0), vy = (keysHeld.ArrowDown ? 1 : 0) - (keysHeld.ArrowUp ? 1 : 0);
      if (vx || vy) me.target = Math.atan2(vy, vx);
      me.turnInput = (keysHeld.KeyD ? 1 : 0) - (keysHeld.KeyA ? 1 : 0);
    }
    for (var k = 0; k < ps.length; k++) if (ps[k].alive && ps[k].isBot) AI.think(g, ps[k], S.diff);
    g.step();
    for (var e = 0; e < g.events.length; e++) handleEvent(g.events[e]);
    g.events.length = 0;
    for (k = 0; k < ps.length; k++) {
      var p = ps[k];
      if (!p.alive && p.isBot) {
        if (!p.respawnAt) p.respawnAt = g.tickNo + RESPAWN_TICKS;
        else if (g.tickNo >= p.respawnAt) { if (g.spawn(p)) p.respawnAt = 0; else p.respawnAt = g.tickNo + 10; }
      }
    }
  }

  function handleEvent(ev) {
    if (ev.type === 'death') {
      var v = ev.victim;
      effects.push({ x: v.x, y: v.y, color: v.color, t0: performance.now() });
      if (v === me) { gameOver(ev); return; }
      if (ev.killer === me) feed('הבסת את ' + v.name + '! ⚔️');
      else if (ev.killer) feed(ev.killer.name + ' הביס את ' + v.name);
    }
  }
  function feed(msg) {
    var el = document.createElement('div'); el.textContent = msg;
    var f = $('feed'); f.insertBefore(el, f.firstChild);
    while (f.children.length > 3) f.removeChild(f.lastChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2500);
  }

  // ---------- ציור ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, S.dpr || 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    unitPx = Math.max(12, Math.min(W, H) / VIEW_UNITS) * DPR;
    Avatars.clear();
    layer = null;
    if (state === 'paused' || state === 'over') render(1, performance.now());
  }
  window.addEventListener('resize', function () { if (g) resize(); });

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* שכבת רקע+שטח בגודל המסך + שוליים. מצוירת מחדש רק כשהמצלמה יוצאת מהשוליים
     או כשהשטח משתנה (ואז רק באזור שהשתנה). */
  function renderLayer(x0, y0, x1, y1) {
    var c = layerCtx, N = g.W;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (x0 != null) {
      var sx = (x0 - layerX) * unitPx, sy = (y0 - layerY) * unitPx;
      c.beginPath(); c.rect(Math.floor(sx), Math.floor(sy), Math.ceil((x1 - x0) * unitPx) + 2, Math.ceil((y1 - y0) * unitPx) + 2); c.clip();
    }
    c.fillStyle = '#2a2c45'; c.fillRect(0, 0, layer.width, layer.height);
    c.setTransform(unitPx, 0, 0, unitPx, -layerX * unitPx, -layerY * unitPx);
    c.fillStyle = '#eef0fa'; c.fillRect(0, 0, N, N);
    // רשת עדינה כל 4 יחידות
    var gx0 = Math.max(0, Math.floor(layerX / 4) * 4), gy0 = Math.max(0, Math.floor(layerY / 4) * 4);
    var gx1 = Math.min(N, layerX + layer.width / unitPx), gy1 = Math.min(N, layerY + layer.height / unitPx);
    c.strokeStyle = '#e1e4f3'; c.lineWidth = 0.08; c.beginPath();
    for (var x = gx0; x <= gx1; x += 4) { c.moveTo(x, Math.max(0, layerY)); c.lineTo(x, gy1); }
    for (var y = gy0; y <= gy1; y += 4) { c.moveTo(Math.max(0, layerX), y); c.lineTo(gx1, y); }
    c.stroke();
    var id;
    // צל רך מתחת לכל שטח
    c.translate(0, 0.28);
    for (id = 1; id < paths.length; id++) if (paths[id]) { c.fillStyle = darkCss[id]; c.fill(paths[id], 'evenodd'); }
    c.translate(0, -0.28);
    c.lineJoin = 'round'; c.lineWidth = 0.14;
    for (id = 1; id < paths.length; id++) if (paths[id]) {
      c.fillStyle = fillCss[id]; c.fill(paths[id], 'evenodd');
      c.strokeStyle = lineCss[id]; c.stroke(paths[id]);
    }
    // גבול המפה
    c.strokeStyle = '#ff4d6d'; c.lineWidth = 0.25; c.strokeRect(0, 0, N, N);
    c.restore();
  }

  var frames = 0;
  function render(alpha, now) {
    if (!g) return;
    frames++;
    var cw = canvas.width, ch = canvas.height;
    if (me.alive) { camX = lerp(me.px, me.x, alpha); camY = lerp(me.py, me.y, alpha); }
    var vx0 = camX - cw / 2 / unitPx, vy0 = camY - ch / 2 / unitPx, vw = cw / unitPx, vh = ch / unitPx;
    var margin = 8;
    if (!layer || vx0 < layerX || vy0 < layerY || vx0 + vw > layerX + layer.width / unitPx || vy0 + vh > layerY + layer.height / unitPx) {
      if (!layer) { layer = document.createElement('canvas'); layer.width = Math.ceil(cw + 2 * margin * unitPx); layer.height = Math.ceil(ch + 2 * margin * unitPx); layerCtx = layer.getContext('2d', { alpha: false }); }
      layerX = vx0 - margin; layerY = vy0 - margin;
      renderLayer(); dirtyWorld = null;
    } else if (dirtyWorld) {
      var d = dirtyWorld; dirtyWorld = null;
      if (d[2] > layerX && d[3] > layerY && d[0] < layerX + layer.width / unitPx && d[1] < layerY + layer.height / unitPx) renderLayer(d[0], d[1], d[2], d[3]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, Math.round((layerX - vx0) * unitPx), Math.round((layerY - vy0) * unitPx));

    // שובלים – קווים מעוגלים
    ctx.setTransform(unitPx, 0, 0, unitPx, -vx0 * unitPx, -vy0 * unitPx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 0.8;
    var ps = g.players, k, p;
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.alive || !p.trail.length) continue;
      var t = p.trail;
      ctx.strokeStyle = trailCss[p.id]; ctx.beginPath(); ctx.moveTo(t[0], t[1]);
      for (var i = 2; i < t.length; i += 2) ctx.lineTo(t[i], t[i + 1]);
      ctx.lineTo(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha));
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // דמויות
    var size = Math.round(unitPx * 1.9);
    var fontPx = Math.round(Math.max(11 * DPR, unitPx * 0.5));
    ctx.font = '700 ' + fontPx + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.alive) continue;
      var hx = (lerp(p.px, p.x, alpha) - vx0) * unitPx, hy = (lerp(p.py, p.y, alpha) - vy0) * unitPx;
      if (hx < -size * 2 || hy < -size * 2 || hx > cw + size * 2 || hy > ch + size * 2) continue;
      var head = p.ph + Game.angDiff(p.h, p.ph) * alpha;
      var blink = 0;
      if (now > p.blinkAt) { var bt = (now - p.blinkAt) / 140; if (bt >= 1) p.blinkAt = now + 2000 + Math.random() * 3500; else blink = Math.sin(bt * Math.PI); }
      Avatars.draw(ctx, p.avatar, p.color, hx, hy, size, head, 1, blink);
      ctx.lineWidth = Math.max(2, fontPx * 0.25); ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.strokeText(p.name, hx, hy - size * 0.62);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name, hx, hy - size * 0.62);
    }
    // אפקט פסילה
    for (var e = effects.length - 1; e >= 0; e--) {
      var f = effects[e], age = (now - f.t0) / 600;
      if (age >= 1) { effects.splice(e, 1); continue; }
      ctx.globalAlpha = 1 - age; ctx.strokeStyle = f.color; ctx.lineWidth = unitPx * 0.3;
      ctx.beginPath(); ctx.arc((f.x - vx0) * unitPx, (f.y - vy0) * unitPx, unitPx * (0.6 + age * 3), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function updateHud(force) {
    if (!g) return;
    $('pct').textContent = g.pct(me).toFixed(1) + '%';
    $('kills').textContent = '⚔️ ' + me.kills;
    var list = g.players.filter(function (p) { return p.alive; }).sort(function (a, b) { return g.counts[b.id] - g.counts[a.id]; }).slice(0, 5);
    if (me.alive && list.indexOf(me) < 0) list.push(me);
    var key = list.map(function (p) { return p.id + ':' + g.pct(p).toFixed(1); }).join(',');
    if (key !== lastBoardKey || force) {
      lastBoardKey = key;
      var html = '';
      list.forEach(function (p) {
        html += '<li class="' + (p === me ? 'me' : '') + '"><img src="' + avatarURLs[p.id] + '" alt="">' + esc(p.name) + '<span class="p">' + g.pct(p).toFixed(1) + '%</span></li>';
      });
      $('board').innerHTML = html;
    }
    if (S.mini) {
      if (mmDirty) { mmCtx.putImageData(mmImg, 0, 0); mmDirty = false; }
      var mw = mini.width;
      mctx.clearRect(0, 0, mw, mw); mctx.imageSmoothingEnabled = true;
      mctx.drawImage(mm, 0, 0, mw, mw);
      if (me.alive) { mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(me.x / g.W * mw, me.y / g.W * mw, 3, 0, 7); mctx.fill(); }
    }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- השהיה / סיום ----------
  function pause() {
    if (state !== 'play') return;
    state = 'paused'; stopLoop(); show('paused');
  }
  function resume() {
    if (state !== 'paused') return;
    show(null); state = 'play'; acc = 0; startLoop();
  }
  function toMenu() {
    state = 'menu'; stopLoop(); g = null;
    $('hud').classList.add('hidden'); $('joyBase').classList.add('hidden');
    ctx.fillStyle = '#1b1d2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    showBest(); show('menu');
  }
  function gameOver(ev) {
    state = 'dying';
    if (S.vib && navigator.vibrate) try { navigator.vibrate(180); } catch (e) {}
    var kills = me.kills, best = me.bestPct;
    if (best > BEST.pct) BEST.pct = best;
    if (kills > BEST.kills) BEST.kills = kills;
    save('kovesh.best', BEST);
    var reasons = { wall: 'נתקלת בקצה המפה', self: 'נגעת בשובל של עצמך', head: 'התנגשות ראש בראש', trail: 'מישהו חצה את השובל שלך', territory: 'כל השטח שלך נכבש' };
    var r = reasons[ev.reason] || '';
    if (ev.killer) r += ' – ' + ev.killer.name;
    $('overReason').textContent = r;
    $('overAvatar').src = Avatars.dataURL(me.avatar, 160, me.color);
    $('overPct').textContent = best.toFixed(1) + '%';
    $('overKills').textContent = kills;
    $('overTitle').textContent = (best > startBest.pct || kills > startBest.kills) ? 'שיא חדש! 🏆' : 'נפסלת!';
    showBest();
    // ממשיכים לצייר רגע קט בשביל האפקט, ואז עוצרים הכול
    setTimeout(function () {
      if (state !== 'dying') return;
      state = 'over'; stopLoop(); show('over'); $('joyBase').classList.add('hidden');
    }, 900);
  }

  // חיסכון בסוללה: כשהדף מוסתר – עוצרים הכול ומשהים
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (state === 'play') pause();
      if (state === 'dying') { state = 'over'; show('over'); }
      stopLoop();
    }
  });
  window.addEventListener('pagehide', function () { if (state === 'play') pause(); });

  // ---------- קלט ----------
  // חיצים: כיוון מוחלט (כולל אלכסונים, 8 כיוונים); A/D: סיבוב שמאלה/ימינה כל עוד לוחצים
  var HOLD = { ArrowRight: 1, ArrowLeft: 1, ArrowUp: 1, ArrowDown: 1, KeyA: 1, KeyD: 1 };
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter' && state === 'menu') startGame(); return; }
    if (e.code === 'KeyP' || e.key === 'Escape') { if (state === 'play') pause(); else if (state === 'paused') resume(); e.preventDefault(); return; }
    if (e.key === 'Enter' && (state === 'menu' || state === 'over')) { startGame(); return; }
    var c = HOLD[e.code] ? e.code : (HOLD[e.key] ? e.key : null);
    if (c && state === 'play') { keysHeld[c] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { delete keysHeld[e.code]; delete keysHeld[e.key]; });
  window.addEventListener('blur', function () { keysHeld = {}; });

  // גרירה (כיוון האצבע) / ג'ויסטיק אנלוגי
  var touchId = null, sx = 0, sy = 0, joyBase = $('joyBase'), joyKnob = $('joyKnob');
  var DRAG_MIN = 10, DRAG_LEASH = 55, JOY_R = 50, JOY_DEAD = 10;
  function joyRest() {
    joyBase.style.left = (W - 95) + 'px'; joyBase.style.top = (H - 110) + 'px';
    joyKnob.style.transform = '';
  }
  function joySetup() { joyBase.classList.toggle('hidden', !S.joy); if (S.joy) joyRest(); }
  canvas.addEventListener('pointerdown', function (e) {
    if (state !== 'play' || touchId !== null) return;
    touchId = e.pointerId; sx = e.clientX; sy = e.clientY;
    if (S.joy) { joyBase.style.left = sx + 'px'; joyBase.style.top = sy + 'px'; joyKnob.style.transform = ''; }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== touchId || state !== 'play' || !me.alive) return;
    var dx = e.clientX - sx, dy = e.clientY - sy, dist = Math.hypot(dx, dy);
    if (S.joy) {
      var k = dist > JOY_R ? JOY_R / dist : 1;
      joyKnob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
      if (dist > JOY_DEAD) me.target = Math.atan2(dy, dx);
    } else if (dist > DRAG_MIN) {
      me.target = Math.atan2(dy, dx);
      // נקודת העוגן נגררת אחרי האצבע, כך שהכיוון תמיד לפי התנועה האחרונה
      if (dist > DRAG_LEASH) { sx = e.clientX - dx / dist * DRAG_LEASH; sy = e.clientY - dy / dist * DRAG_LEASH; }
    }
  });
  function endTouch(e) { if (e.pointerId !== touchId) return; touchId = null; if (S.joy) joyRest(); }
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  // ---------- Service Worker (עבודה בלי אינטרנט) ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // חשיפה לבדיקות אוטומטיות בלבד
  window.__kovesh = { get frames() { return frames; }, get game() { return g; }, get me() { return me; }, get state() { return state; }, start: startGame, pause: pause };
})();
