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

  var COLORS = ['#5b3df5', '#ff4d6d', '#16b978', '#ff9f1c', '#1ea7fd', '#c04bf2', '#e8c600', '#ff6fb5', '#00b3a4', '#8d6e63'];
  var BOT_NAMES = ['שועל', 'נמר', 'ינשוף', 'דב', 'זאב', 'צבי', 'נשר', 'תנין', 'פנתר', 'דולפין'];
  var TICK_MS = 125;              // 8 תאים בשנייה
  var RESPAWN_TICKS = 24;         // ~3 שניות
  var VIEW_CELLS = 20;            // כמה תאים רואים לאורך הצלע הקצרה

  // ---------- מצב ----------
  var canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  var mini = $('minimap'), mctx = mini.getContext('2d');
  var g = null, me = null, state = 'menu';
  var W = 0, H = 0, DPR = 1, cellPx = 20;
  var rafId = 0, lastFrame = 0, acc = 0, lastHud = 0;
  var terr = null, terrCtx = null, terrImg = null, terrData = null;   // שטח + שובלים
  var shadow = null, shadowCtx = null, shadowImg = null, shadowData = null;
  var bg = null;
  var rgb = [], trailRgb = [], darkRgb = [];
  var camX = 0, camY = 0, effects = [], avatarURLs = [], lastBoardKey = '', startBest = { pct: 0, kills: 0 };

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
      var img = new Image(); img.src = Avatars.dataURL(i, 96, COLORS[i]); img.alt = a.name;
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

  function startGame() {
    S.name = $('nameInput').value.trim(); save('kovesh.settings', S);
    g = new Game({ size: S.size });
    startBest = { pct: BEST.pct, kills: BEST.kills };
    var avatars = [S.avatar], colors = [COLORS[S.avatar % COLORS.length]];
    me = g.addPlayer({ name: S.name || 'אני', avatar: S.avatar, color: colors[0] });
    var freeAv = []; for (var i = 0; i < Avatars.list.length; i++) if (i !== S.avatar) freeAv.push(i);
    var freeCol = COLORS.filter(function (c) { return c !== colors[0]; });
    shuffle(freeAv); shuffle(freeCol);
    var names = BOT_NAMES.slice(); shuffle(names);
    for (var b = 0; b < S.bots; b++) {
      g.addPlayer({ name: names[b], isBot: true, avatar: freeAv[b % freeAv.length], color: freeCol[b % freeCol.length] });
    }
    // צבעים לתמונת השטח
    rgb = [[0, 0, 0]]; trailRgb = [[0, 0, 0]]; darkRgb = [[0, 0, 0]];
    avatarURLs = [null];
    g.players.forEach(function (p) {
      var c = hexRgb(p.color);
      rgb[p.id] = c; trailRgb[p.id] = mix(c, [255, 255, 255], 0.45); darkRgb[p.id] = mix(c, [0, 0, 0], 0.35);
      avatarURLs[p.id] = Avatars.dataURL(p.avatar, 64, p.color);
    });
    g.spawn(me, { x: Math.floor(g.N / 2), y: Math.floor(g.N / 2) });
    for (var k = 1; k < g.players.length; k++) g.spawn(g.players[k]);
    setupTerrain();
    effects = []; camX = me.x + 0.5; camY = me.y + 0.5;
    $('hudAvatar').src = avatarURLs[me.id];
    $('feed').innerHTML = ''; lastBoardKey = '';
    $('minimap').classList.toggle('hidden', !S.mini);
    resize();
    show(null); $('hud').classList.remove('hidden');
    joySetup();
    state = 'play'; acc = 0; lastFrame = 0;
    updateHud(true);
    startLoop();
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function setupTerrain() {
    var N = g.N;
    terr = document.createElement('canvas'); terr.width = terr.height = N; terrCtx = terr.getContext('2d');
    terrImg = terrCtx.createImageData(N, N); terrData = terrImg.data;
    shadow = document.createElement('canvas'); shadow.width = shadow.height = N; shadowCtx = shadow.getContext('2d');
    shadowImg = shadowCtx.createImageData(N, N); shadowData = shadowImg.data;
    // רקע משבצות – נבנה פעם אחת
    bg = document.createElement('canvas'); bg.width = bg.height = N;
    var bctx = bg.getContext('2d'), bi = bctx.createImageData(N, N), bd = bi.data;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var o = (y * N + x) * 4, alt = (x + y) & 1;
      bd[o] = alt ? 232 : 240; bd[o + 1] = alt ? 234 : 242; bd[o + 2] = alt ? 246 : 251; bd[o + 3] = 255;
    }
    bctx.putImageData(bi, 0, 0);
    g.allDirty = true; flushTerrain();
  }
  function paintCell(i) {
    var o = i * 4, t = g.trail[i], w = g.owner[i], c;
    if (t) { c = trailRgb[t]; terrData[o] = c[0]; terrData[o + 1] = c[1]; terrData[o + 2] = c[2]; terrData[o + 3] = 235; }
    else if (w) { c = rgb[w]; terrData[o] = c[0]; terrData[o + 1] = c[1]; terrData[o + 2] = c[2]; terrData[o + 3] = 255; }
    else terrData[o + 3] = 0;
    if (w) { c = darkRgb[w]; shadowData[o] = c[0]; shadowData[o + 1] = c[1]; shadowData[o + 2] = c[2]; shadowData[o + 3] = 255; }
    else shadowData[o + 3] = 0;
  }
  // מעדכנים רק תאים שהשתנו
  function flushTerrain() {
    if (g.allDirty) { for (var i = 0, n = g.N * g.N; i < n; i++) paintCell(i); g.allDirty = false; g.dirty.length = 0; }
    else if (g.dirty.length) { for (var k = 0; k < g.dirty.length; k++) paintCell(g.dirty[k]); g.dirty.length = 0; }
    else return;
    terrCtx.putImageData(terrImg, 0, 0); shadowCtx.putImageData(shadowImg, 0, 0);
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
    while (acc >= TICK_MS && ticks < 4) { tick(); acc -= TICK_MS; ticks++; }
    if (ticks) flushTerrain();
    render(Math.min(1, acc / TICK_MS), now);
    if (now - lastHud > 400) { lastHud = now; updateHud(false); }
  }

  function tick() {
    var ps = g.players;
    for (var k = 0; k < ps.length; k++) if (ps[k].alive && ps[k].isBot) AI.think(g, ps[k], S.diff);
    g.step();
    for (var e = 0; e < g.events.length; e++) handleEvent(g.events[e]);
    g.events.length = 0;
    for (k = 0; k < ps.length; k++) {
      var p = ps[k];
      if (!p.alive && p.isBot) {
        if (!p.respawnAt) p.respawnAt = g.tickNo + RESPAWN_TICKS;
        else if (g.tickNo >= p.respawnAt) { if (g.spawn(p)) p.respawnAt = 0; else p.respawnAt = g.tickNo + 8; }
      }
    }
  }

  function handleEvent(ev) {
    if (ev.type === 'death') {
      var v = ev.victim;
      effects.push({ x: v.x + 0.5, y: v.y + 0.5, color: v.color, t0: performance.now() });
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
    cellPx = Math.max(14, Math.min(W, H) / VIEW_CELLS) * DPR;
    Avatars.clear();
    if (state === 'paused' || state === 'over') render(1, performance.now());
  }
  window.addEventListener('resize', function () { if (g) resize(); });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function render(alpha, now) {
    if (!g) return;
    var N = g.N, cw = canvas.width, ch = canvas.height;
    // מצלמה עוקבת אחרי השחקן (עם החלקה קלה)
    if (me.alive) {
      var tx = lerp(me.px, me.x, alpha) + 0.5, ty = lerp(me.py, me.y, alpha) + 0.5;
      camX += (tx - camX) * 0.35; camY += (ty - camY) * 0.35;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2a2c45'; ctx.fillRect(0, 0, cw, ch);
    var ox = cw / 2 - camX * cellPx, oy = ch / 2 - camY * cellPx;
    // תחום תאים נראה
    var x0 = Math.max(0, Math.floor(-ox / cellPx) - 1), y0 = Math.max(0, Math.floor(-oy / cellPx) - 1);
    var x1 = Math.min(N, Math.ceil((cw - ox) / cellPx) + 1), y1 = Math.min(N, Math.ceil((ch - oy) / cellPx) + 1);
    if (x1 > x0 && y1 > y0) {
      var sw = x1 - x0, sh = y1 - y0, dx = ox + x0 * cellPx, dy = oy + y0 * cellPx;
      ctx.drawImage(bg, x0, y0, sw, sh, dx, dy, sw * cellPx, sh * cellPx);
      var sOff = Math.round(cellPx * 0.22);
      ctx.drawImage(shadow, x0, y0, sw, sh, dx, dy + sOff, sw * cellPx, sh * cellPx);
      ctx.drawImage(terr, x0, y0, sw, sh, dx, dy, sw * cellPx, sh * cellPx);
    }
    // מסגרת המפה
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = Math.max(2, cellPx * 0.15);
    ctx.strokeRect(ox, oy, N * cellPx, N * cellPx);

    // ראשים (דמויות) – מודבקות מקנבס מוכן לפי כיוון
    var avSize = Math.round(cellPx * 2.0);
    var fontPx = Math.round(Math.max(11 * DPR, cellPx * 0.5));
    ctx.font = '700 ' + fontPx + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.imageSmoothingEnabled = true;
    for (var k = 0; k < g.players.length; k++) {
      var p = g.players[k];
      if (!p.alive) continue;
      var hx = ox + (lerp(p.px, p.x, alpha) + 0.5) * cellPx, hy = oy + (lerp(p.py, p.y, alpha) + 0.5) * cellPx;
      if (hx < -avSize || hy < -avSize || hx > cw + avSize || hy > ch + avSize) continue;
      var img = Avatars.get(p.avatar, p.dir, avSize, p.color);
      ctx.drawImage(img, hx - avSize / 2, hy - avSize / 2);
      ctx.lineWidth = Math.max(2, fontPx * 0.25); ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(p.name, hx, hy - avSize * 0.5);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name, hx, hy - avSize * 0.5);
    }
    // אפקט פסילה
    for (var e = effects.length - 1; e >= 0; e--) {
      var f = effects[e], age = (now - f.t0) / 600;
      if (age >= 1) { effects.splice(e, 1); continue; }
      var ex = ox + f.x * cellPx, ey = oy + f.y * cellPx;
      ctx.globalAlpha = 1 - age; ctx.strokeStyle = f.color; ctx.lineWidth = cellPx * 0.3;
      ctx.beginPath(); ctx.arc(ex, ey, cellPx * (0.5 + age * 2.5), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function updateHud(force) {
    if (!g) return;
    $('pct').textContent = g.pct(me).toFixed(1) + '%';
    $('kills').textContent = '⚔️ ' + me.kills;
    // טבלת מובילים
    var list = g.players.filter(function (p) { return p.alive; }).sort(function (a, b) { return g.counts[b.id] - g.counts[a.id]; }).slice(0, 5);
    if (me.alive && list.indexOf(me) < 0) list.push(me);
    var key = list.map(function (p) { return p.id + ':' + g.pct(p).toFixed(1); }).join(',');
    if (key !== lastBoardKey || force) {
      lastBoardKey = key;
      var html = '';
      list.forEach(function (p, i) {
        html += '<li class="' + (p === me ? 'me' : '') + '"><img src="' + avatarURLs[p.id] + '" alt="">' + esc(p.name) + '<span class="p">' + g.pct(p).toFixed(1) + '%</span></li>';
      });
      $('board').innerHTML = html;
    }
    // מפה קטנה – מתעדכנת רק כמה פעמים בשנייה
    if (S.mini) {
      var mw = mini.width;
      mctx.clearRect(0, 0, mw, mw); mctx.imageSmoothingEnabled = false;
      mctx.drawImage(terr, 0, 0, mw, mw);
      if (me.alive) { mctx.fillStyle = '#fff'; mctx.fillRect(me.x / g.N * mw - 2, me.y / g.N * mw - 2, 5, 5); }
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
  var KEYS = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 };
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter' && state === 'menu') startGame(); return; }
    if (e.code === 'KeyP' || e.key === 'Escape') { if (state === 'play') pause(); else if (state === 'paused') resume(); e.preventDefault(); return; }
    if (e.key === 'Enter' && (state === 'menu' || state === 'over')) { startGame(); return; }
    var d = KEYS[e.code]; if (d === undefined) d = KEYS[e.key];
    if (d !== undefined && state === 'play' && me) { g.turn(me, d); e.preventDefault(); }
  });

  // החלקה / ג'ויסטיק
  var touchId = null, sx = 0, sy = 0, joyBase = $('joyBase'), joyKnob = $('joyKnob');
  var SWIPE = 22, JOY_R = 50, JOY_DEAD = 14;
  function dirFrom(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); }
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
    if (e.pointerId !== touchId || state !== 'play') return;
    var dx = e.clientX - sx, dy = e.clientY - sy, dist = Math.hypot(dx, dy);
    if (S.joy) {
      var k = dist > JOY_R ? JOY_R / dist : 1;
      joyKnob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
      if (dist > JOY_DEAD) g.turn(me, dirFrom(dx, dy));
    } else if (dist > SWIPE) {
      g.turn(me, dirFrom(dx, dy)); sx = e.clientX; sy = e.clientY;   // אפשר להמשיך להחליק ולפנות שוב
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
  window.__kovesh = { get game() { return g; }, get me() { return me; }, get state() { return state; }, start: startGame, pause: pause };
})();
