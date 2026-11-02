/* Emojiverse (לשעבר כובש) – ממשק, ציור, קלט ולולאת משחק. נכתב מאפס. */
(function () {
  'use strict';
  // המשחק לא צריך שום רכיב חיצוני: מבטלים וידג'ט תגובות שהאחסון מזריק לדף (בלי רשת, בלי מעקב)
  window.__flypodCommentsLoaded = true;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- הגדרות ושיאים ----------
  var DEFAULTS = { name: '', avatar: 0, diff: 'normal', bots: 6, size: 100, fps: 60, dpr: 2, joy: false, ctrl: 'point', v: 6, emoji: '', mini: true, vib: true, sens: 'medium' };
  var S = load('kovesh.settings', DEFAULTS);
  if ((S.v || 0) < 4) { S.ctrl = S.joy ? 'joy' : 'point'; if (S.fps < 60) S.fps = 60; S.v = 4; save('kovesh.settings', S); } // מעבר ל-v4
  if ((S.v || 0) < 6) { S.emoji = ''; S.v = 6; save('kovesh.settings', S); } // v6: דמויות אימוג'י – הבחירה הישנה => אקראי
  var BEST = load('kovesh.best', { pct: 0, kills: 0 });
  function load(k, def) {
    try { var v = JSON.parse(localStorage.getItem(k)); return Object.assign({}, def, v || {}); } catch (e) { return Object.assign({}, def); }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var EXTRA_COLORS = ['#c98a96', '#8e9bb3', '#c2b48a'];   // פסטל נורדי נוסף לבוטים כפולים
  var BOT_NAMES = ['שועל', 'נמר', 'ינשוף', 'דב', 'זאב', 'צבי', 'נשר', 'תנין', 'פנתר', 'דולפין'];
  var TICK_MS = 1000 / 60;        // 60 צעדי לוגיקה בשנייה (קבוע), רק בזמן משחק פעיל
  var RESPAWN_TICKS = 180;        // ~3 שניות
  // זום: אורך אלכסון המסך ביחידות עולם. מתחיל קרוב (≈44 רוחבי שובל) ומתרחק בהדרגה ככל שהשטח גדל.
  var VIEW_DIAG_MIN = 36, VIEW_DIAG_MAX = 52, viewDiag = VIEW_DIAG_MIN;

  // ---------- מצב ----------
  var canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  var mini = $('minimap'), mctx = mini.getContext('2d');
  var g = null, me = null, state = 'menu';
  var mode = 'solo', MPH = null, match = null; // מצב רשת: solo / host / client (ראו js/mp.js)
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
  seg('diffSeg', 'diff'); seg('botsSeg', 'bots', Number); seg('sizeSeg', 'size', Number); seg('fpsSeg', 'fps', Number); seg('dprSeg', 'dpr', Number); seg('sensSeg', 'sens'); seg('ctrlSeg', 'ctrl');
  $('nameInput').value = S.name;
  $('miniChk').checked = S.mini; $('vibChk').checked = S.vib;

  /* בוחר אימוג'י: 🎲 אקראי (ברירת מחדל) + רשימה. נשמר ב-localStorage */
  function buildAvatarPick() {
    var el = $('avatarPick'); el.innerHTML = '';
    [''].concat(Emoji.LIST).forEach(function (e) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'emo' + (e === (S.emoji || '') ? ' on' : '') + (e ? '' : ' rnd');
      b.textContent = e || '🎲 אקראי'; b.setAttribute('aria-label', e || 'אקראי');
      b.addEventListener('click', function () { S.emoji = e; save('kovesh.settings', S); buildAvatarPick(); });
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
    [].forEach.call(document.querySelectorAll('section.screen'), function (el) { el.classList.toggle('hidden', el.id !== id); });
  }
  $('playBtn').onclick = startGame;
  $('settingsBtn').onclick = function () { show('settings'); };
  $('helpBtn').onclick = function () { show('help'); };
  $('helpBack').onclick = function () { show('menu'); };
  $('settingsBack').onclick = function () {
    S.mini = $('miniChk').checked; S.vib = $('vibChk').checked;
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
  var SLATE = [46, 52, 64];
  // הגברת רוויה (HSL) לשובל
  function saturate(c, sm, lm) {
    var r = c[0] / 255, g2 = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g2 - b) / d + (g2 < b ? 6 : 0) : mx === g2 ? (b - r) / d + 2 : (r - g2) / d + 4; h /= 6; }
    s = Math.min(1, s * sm); l = l * lm;
    function f(t) { var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  function css(c, a) { return a == null ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function startGame() {
    mode = 'solo'; match = null; $('timer').classList.add('hidden');
    S.name = $('nameInput').value.trim(); save('kovesh.settings', S);
    g = new Game({ size: S.size });
    startBest = { pct: BEST.pct, kills: BEST.kills };
    var myAv = 0, myCol = Avatars.list[myAv].color;   // צבעי השטח – פלטת הפסטל הנורדי
    var myEmo = Emoji.valid(S.emoji) ? S.emoji : Emoji.randomFree([]), usedEmo = [myEmo];
    me = g.addPlayer({ name: S.name || 'אני', avatar: myAv, color: myCol, emoji: myEmo });
    var freeAv = []; for (var i = 0; i < Avatars.list.length; i++) if (i !== myAv) freeAv.push(i);
    shuffle(freeAv);
    var names = BOT_NAMES.slice(); shuffle(names);
    var extra = EXTRA_COLORS.slice();
    for (var b = 0; b < S.bots; b++) {
      var av = freeAv[b % freeAv.length];
      // דמות שחוזרת פעמיים מקבלת צבע אחר
      var col = b < freeAv.length ? Avatars.list[av].color : extra.shift();
      var be = Emoji.randomFree(usedEmo); usedEmo.push(be);
      g.addPlayer({ name: names[b], isBot: true, avatar: av, color: col, emoji: be });
    }
    styleAll();
    g.spawn(me, { x: g.W / 2, y: g.W / 2 });
    for (var k = 1; k < g.players.length; k++) g.spawn(g.players[k]);
    beginPlay();
  }
  function styleAll() {
    rgb = [[0, 0, 0]]; trailCss = ['']; darkCss = ['']; fillCss = ['']; lineCss = [''];
    avatarURLs = [null];
    g.players.forEach(stylePlayer);
  }
  function stylePlayer(p) {
    var c = hexRgb(p.color);
    rgb[p.id] = c; fillCss[p.id] = p.color;
    trailCss[p.id] = css(saturate(c, 1.45, 0.9), 0.9);                 // אותו גוון, רווי יותר
    darkCss[p.id] = css(mix(c, SLATE, 0.3), 0.55);                     // צל רך
    lineCss[p.id] = css(mix(c, SLATE, p === me ? 0.45 : 0.25));        // קו מתאר כהה יותר באותו גוון
    avatarURLs[p.id] = Emoji.dataURL(p.emoji, 64, p.color, lineCss[p.id]);
    p.blinkAt = performance.now() + 1000 + Math.random() * 3000;
  }
  function beginPlay() {
    paths = [];
    setupMinimap();
    effects = []; camX = me.x; camY = me.y; layer = null;
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
  /* משחק רשת. cfg: { mode:'host'|'client', size, roster:[{name,avatar,color,isBot}], myId, diff, roundMs }
     במארח: סימולציה מלאה. בלקוח: משחק "מראה" שמתעדכן מתמונות המצב (בלי step). */
  function startMatch(cfg) {
    mode = cfg.mode; match = { diff: cfg.diff || 'easy', roundMs: cfg.roundMs, endTick: 0, msLeft: cfg.roundMs };
    g = new Game({ size: cfg.size });
    cfg.roster.forEach(function (r) { g.addPlayer(r); });
    me = g.players[cfg.myId - 1];
    styleAll();
    if (mode === 'host') {
      var n = g.players.length;
      for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2; g.spawn(g.players[k], g.findSpawn() || { x: g.W / 2 + Math.cos(a) * g.W * 0.3, y: g.W / 2 + Math.sin(a) * g.W * 0.3 }); }
      match.endTick = g.tickNo + Math.round(cfg.roundMs / TICK_MS);
    }
    $('timer').classList.remove('hidden');
    beginPlay();
    return g;
  }
  /* הצטרפות באמצע סיבוב (מארח) או עדכון רשימה (לקוח) */
  function addMatchPlayer(r, spawn) {
    var p = g.addPlayer(r); stylePlayer(p);
    if (spawn) g.spawn(p);
    return p;
  }
  function endRound() {
    if (mode === 'solo') return;
    state = 'results'; stopLoop(); touchId = null; $('joyBase').classList.add('hidden');
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
    if (mode === 'client') {   // לקוח: אין סימולציה – מיקומים מאינטרפולציה של תמונות המצב
      clientKeys();
      if (MPH) MPH.clientFrame(now);
      flushTerrain(); updateZoom(dt); render(0, now);
      if (now - lastHud > 400) { lastHud = now; updateHud(false); }
      return;
    }
    acc += dt;
    var ticks = 0;
    while (acc >= TICK_MS && ticks < 6 && (state === 'play' || state === 'dying')) { tick(); acc -= TICK_MS; ticks++; }
    if (ticks) flushTerrain();
    if (!g) return;
    updateZoom(dt);
    render(Math.min(1, acc / TICK_MS), now);
    if (now - lastHud > 400) { lastHud = now; updateHud(false); }
  }

  function clientKeys() {
    if (!me || !me.alive) return;
    var vx = (keysHeld.ArrowRight ? 1 : 0) - (keysHeld.ArrowLeft ? 1 : 0), vy = (keysHeld.ArrowDown ? 1 : 0) - (keysHeld.ArrowUp ? 1 : 0);
    if (vx || vy) steer(Math.atan2(vy, vx));
    var t = (keysHeld.KeyD ? 1 : 0) - (keysHeld.KeyA ? 1 : 0);
    if (t) steer(me.h + t * 0.6);
  }
  function tick() {
    var ps = g.players;
    // מקלדת
    if (me.alive) {
      var vx = (keysHeld.ArrowRight ? 1 : 0) - (keysHeld.ArrowLeft ? 1 : 0), vy = (keysHeld.ArrowDown ? 1 : 0) - (keysHeld.ArrowUp ? 1 : 0);
      if (vx || vy) me.target = Math.atan2(vy, vx);
      me.turnInput = (keysHeld.KeyD ? 1 : 0) - (keysHeld.KeyA ? 1 : 0);
    }
    for (var k = 0; k < ps.length; k++) if (ps[k].alive && ps[k].isBot && (g.tickNo + ps[k].id) % g.AI_EVERY === 0) AI.think(g, ps[k], match ? match.diff : S.diff);
    g.step();
    for (var e = 0; e < g.events.length; e++) handleEvent(g.events[e]);
    g.events.length = 0;
    for (k = 0; k < ps.length; k++) {
      var p = ps[k];
      if (!p.alive && !p.gone && (p.isBot || mode === 'host')) {
        if (!p.respawnAt) p.respawnAt = g.tickNo + RESPAWN_TICKS;
        else if (g.tickNo >= p.respawnAt) { if (g.spawn(p)) p.respawnAt = 0; else p.respawnAt = g.tickNo + 10; }
      }
    }
    if (mode === 'host') {
      match.msLeft = Math.max(0, (match.endTick - g.tickNo) * TICK_MS);
      if (MPH) MPH.onTick();
      if (g && g.tickNo >= match.endTick && state === 'play' && MPH) MPH.roundOver();
    }
  }

  function handleEvent(ev) {
    if (ev.type === 'death') {
      var v = ev.victim;
      effects.push({ x: v.x, y: v.y, color: v.color, t0: performance.now() });
      if (mode === 'host' && MPH) MPH.onEvent(ev);
      if (v === me && mode === 'solo') { gameOver(ev); return; }
      if (v === me) { myDeath(ev); return; }
      if (ev.reason === 'left') { feed(nm(v) + ' עזב/ה את המשחק'); return; }
      if (ev.killer === me) feed('הבסת את ' + nm(v) + '! ⚔️');
      else if (ev.killer) feed(nm(ev.killer) + ' הביס את ' + nm(v));
    }
  }
  function myDeath(ev) {
    if (S.vib && navigator.vibrate) try { navigator.vibrate(150); } catch (e) {}
    var reasons = { wall: 'קצה המפה', self: 'השובל שלך', head: 'ראש בראש', trail: 'חצו לך את השובל', territory: 'השטח נכבש' };
    feed('נפסלת (' + (reasons[ev.reason] || '') + (ev.killer ? ' – ' + nm(ev.killer) : '') + ') · חוזרים בעוד 3 שניות');
  }
  function nm(p) { return (p.emoji ? p.emoji + ' ' : '') + p.name; }
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
    updateZoom(0);
    if (drag) drag.setCenter(W / 2, H / 2);
    Avatars.clear(); Emoji.clear();
    layer = null;
    if (state === 'paused' || state === 'over') render(1, performance.now());
  }
  window.addEventListener('resize', function () { if (g) resize(); });

  /* זום רך: היעד תלוי באחוז השטח (מדרגות של 5%), התקרבות/התרחקות בקבוע זמן ~0.4 שנ' */
  function updateZoom(dtMs) {
    var pct = me && g ? g.pct(me) : 0, f = Math.min(1, Math.floor(pct / 5) * 5 / 40);
    var target = VIEW_DIAG_MIN + (VIEW_DIAG_MAX - VIEW_DIAG_MIN) * f;
    viewDiag = dtMs ? viewDiag + (target - viewDiag) * Math.min(1, dtMs / 400) : target;
    var px = Math.max(12, Math.hypot(W, H) / viewDiag) * DPR;
    if (Math.abs(px - unitPx) > 0.03 * unitPx || (!dtMs && px !== unitPx)) { unitPx = px; layer = null; } // מדרגות של 3% – פחות ציורים מחדש של השכבה
  }
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
    // טורוס: אין "מחוץ למפה" ואין גבול – רקע אחיד ורשת רציפה (4 מחלק את כל גדלי המפה)
    c.fillStyle = '#f4f6fa'; c.fillRect(0, 0, layer.width, layer.height);
    c.setTransform(unitPx, 0, 0, unitPx, -layerX * unitPx, -layerY * unitPx);
    var LW = layer.width / unitPx, LH = layer.height / unitPx;
    var gx0 = Math.floor(layerX / 4) * 4, gy0 = Math.floor(layerY / 4) * 4, gx1 = layerX + LW, gy1 = layerY + LH;
    c.strokeStyle = '#e3e8f0'; c.lineWidth = 0.08; c.beginPath();
    for (var x = gx0; x <= gx1; x += 4) { c.moveTo(x, layerY); c.lineTo(x, gy1); }
    for (var y = gy0; y <= gy1; y += 4) { c.moveTo(layerX, y); c.lineTo(gx1, y); }
    c.stroke();
    // עותקי המפה (היסטים של W) שנוגעים בשכבה; הצורות עצמן עשויות לבלוט עד ~W מחוץ ל-[0,W)
    var k0x = Math.floor(layerX / N) - 1, k1x = Math.floor((layerX + LW) / N) + 1;
    var k0y = Math.floor(layerY / N) - 1, k1y = Math.floor((layerY + LH) / N) + 1;
    var id, kx, ky;
    c.lineJoin = 'round';
    for (ky = k0y; ky <= k1y; ky++) for (kx = k0x; kx <= k1x; kx++) {
      c.save(); c.translate(kx * N, ky * N);
      // צל רך מתחת לכל שטח
      c.translate(0, 0.28);
      for (id = 1; id < paths.length; id++) if (paths[id]) { c.fillStyle = darkCss[id]; c.fill(paths[id].fill, 'evenodd'); }
      c.translate(0, -0.28);
      for (id = 1; id < paths.length; id++) if (paths[id]) {
        c.fillStyle = fillCss[id]; c.fill(paths[id].fill, 'evenodd');
        c.lineWidth = id === me.id ? 0.26 : 0.12;           // השטח שלי בולט יותר
        c.strokeStyle = lineCss[id]; c.stroke(paths[id].stroke);
      }
      c.restore();
    }
    c.restore();
  }
  function trailBox(t) { var b = [t[0], t[1], t[0], t[1]]; for (var i = 2; i < t.length; i += 2) { if (t[i] < b[0]) b[0] = t[i]; if (t[i] > b[2]) b[2] = t[i]; if (t[i + 1] < b[1]) b[1] = t[i + 1]; if (t[i + 1] > b[3]) b[3] = t[i + 1]; } return b; }
  /* העותקים (היסטים בכפולות W) של מלבן עולם [x0,x1] שנחתכים עם [a0,a1] */
  function images(x0, x1, a0, a1) {
    var N = g.W, out = [];
    for (var k = Math.floor((a0 - x1) / N); k <= Math.ceil((a1 - x0) / N); k++) if (x1 + k * N > a0 && x0 + k * N < a1) out.push(k * N);
    return out;
  }

  var frames = 0;
  function render(alpha, now) {
    if (!g) return;
    frames++;
    var cw = canvas.width, ch = canvas.height;
    // מיקום מוצג: מהמצב האחרון קדימה לפי הכיוון העדכני ביותר (כולל קלט שהגיע אחרי הצעד האחרון)
    var ps = g.players, k, p, maxTurn = g.TURN * g.DT, step = g.SPEED * g.DT;
    for (k = 0; k < ps.length; k++) {
      p = ps[k]; if (!p.alive) continue;
      var dh = Game.angDiff(p.target, p.h); if (dh > maxTurn) dh = maxTurn; else if (dh < -maxTurn) dh = -maxTurn;
      p.rh = p.h + dh * alpha;
      p.rx = p.x + Math.cos(p.rh) * step * alpha; p.ry = p.y + Math.sin(p.rh) * step * alpha;
    }
    // מצלמה רציפה: נעה בהפרש העטוף הקצר, כך שבחציית תפר אין קפיצה (camX יכול לצאת מ-[0,W))
    if (me.alive) { camX += g.wd(me.rx - camX); camY += g.wd(me.ry - camY); }
    var vx0 = camX - cw / 2 / unitPx, vy0 = camY - ch / 2 / unitPx, vw = cw / unitPx, vh = ch / unitPx;
    var margin = 8;
    if (!layer || vx0 < layerX || vy0 < layerY || vx0 + vw > layerX + layer.width / unitPx || vy0 + vh > layerY + layer.height / unitPx) {
      if (!layer) { layer = document.createElement('canvas'); layer.width = Math.ceil(cw + 2 * margin * unitPx); layer.height = Math.ceil(ch + 2 * margin * unitPx); layerCtx = layer.getContext('2d', { alpha: false }); }
      layerX = vx0 - margin; layerY = vy0 - margin;
      renderLayer(); dirtyWorld = null;
    } else if (dirtyWorld) {
      var d = dirtyWorld, LW2 = layer.width / unitPx, LH2 = layer.height / unitPx; dirtyWorld = null;
      // האזור המלוכלך (ב-[0,W)) מצויר מחדש בכל עותק שלו שנראה בשכבה – עובד גם מעבר לתפר
      var ix = images(d[0], d[2], layerX, layerX + LW2), iy = images(d[1], d[3], layerY, layerY + LH2);
      for (var a = 0; a < iy.length; a++) for (var b2 = 0; b2 < ix.length; b2++)
        renderLayer(d[0] + ix[b2], d[1] + iy[a], d[2] + ix[b2], d[3] + iy[a]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, Math.round((layerX - vx0) * unitPx), Math.round((layerY - vy0) * unitPx));

    // שובלים – קווים מעוגלים
    ctx.setTransform(unitPx, 0, 0, unitPx, -vx0 * unitPx, -vy0 * unitPx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 0.8;
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.alive || !p.trail.length) continue;
      var t = p.trail, tl = t.length, lx = t[tl - 2], ly = t[tl - 1];
      // הראש "פרוש" ביחס לנקודה האחרונה; השובל כולו מוזז כך שהראש בעותק הקרוב למצלמה
      var hx0 = lx + g.wd(p.x - lx), hy0 = ly + g.wd(p.y - ly), hx1 = hx0 + (p.rx - p.x), hy1 = hy0 + (p.ry - p.y);
      var sx = camX + g.wd(hx1 - camX) - hx1, sy = camY + g.wd(hy1 - camY) - hy1;
      var tb = trailBox(t), bx0 = Math.min(tb[0], hx1) + sx, bx1 = Math.max(tb[2], hx1) + sx, by0 = Math.min(tb[1], hy1) + sy, by1 = Math.max(tb[3], hy1) + sy;
      // עותקים נוספים (±W) רק אם הם נראים – כך השובל נראה משני צדי התפר
      var ox = images(bx0, bx1, vx0 - 1, vx0 + vw + 1), oy = images(by0, by1, vy0 - 1, vy0 + vh + 1);
      ctx.strokeStyle = trailCss[p.id]; ctx.beginPath();
      for (var a2 = 0; a2 < oy.length; a2++) for (var b3 = 0; b3 < ox.length; b3++) {
        var X = sx + ox[b3], Y = sy + oy[a2];
        ctx.moveTo(t[0] + X, t[1] + Y);
        for (var i = 2; i < tl; i += 2) ctx.lineTo(t[i] + X, t[i + 1] + Y);
        ctx.lineTo(hx0 + X, hy0 + Y); ctx.lineTo(hx1 + X, hy1 + Y);
      }
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
      // העותק הקרוב למצלמה, ועוד עותקים אם השחקן ליד תפר ונראה פעמיים (מפה קטנה/מסך רחב)
      var wx = camX + g.wd(p.rx - camX), wy = camY + g.wd(p.ry - camY), pad = 2 * size / unitPx;
      var px2 = images(wx - pad, wx + pad, vx0, vx0 + vw), py2 = images(wy - pad, wy + pad, vy0, vy0 + vh);
      for (var a3 = 0; a3 < py2.length; a3++) for (var b4 = 0; b4 < px2.length; b4++) {
        var hx = (wx + px2[b4] - vx0) * unitPx, hy = (wy + py2[a3] - vy0) * unitPx;
        Emoji.draw(ctx, p.emoji, p.color, lineCss[p.id], hx, hy, size, p.rh);
        ctx.lineWidth = Math.max(2, fontPx * 0.3); ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.strokeText(p.name, hx, hy - size * 0.62);
        ctx.fillStyle = '#3b4252'; ctx.fillText(p.name, hx, hy - size * 0.62);
      }
    }
    // אפקט פסילה
    for (var e = effects.length - 1; e >= 0; e--) {
      var f = effects[e], age = (now - f.t0) / 600;
      if (age >= 1) { effects.splice(e, 1); continue; }
      ctx.globalAlpha = 1 - age; ctx.strokeStyle = f.color; ctx.lineWidth = unitPx * 0.3;
      var fx = camX + g.wd(f.x - camX), fy = camY + g.wd(f.y - camY);
      ctx.beginPath(); ctx.arc((fx - vx0) * unitPx, (fy - vy0) * unitPx, unitPx * (0.6 + age * 3), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function updateHud(force) {
    if (!g) return;
    if (match) { var sec = Math.ceil((match.msLeft || 0) / 1000); $('timer').textContent = Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
    $('pct').textContent = g.pct(me).toFixed(1) + '%';
    $('kills').textContent = '⚔️ ' + me.kills;
    var list = g.players.filter(function (p) { return p.alive && !p.gone; }).sort(function (a, b) { return g.counts[b.id] - g.counts[a.id]; }).slice(0, 5);
    if (me.alive && list.indexOf(me) < 0) list.push(me);
    var key = list.map(function (p) { return p.id + ':' + g.pct(p).toFixed(1); }).join(',');
    if (key !== lastBoardKey || force) {
      lastBoardKey = key;
      var html = '';
      list.forEach(function (p) {
        html += '<li class="' + (p === me ? 'me' : '') + '"><span class="emo-s">' + p.emoji + '</span>' + esc(p.name) + '<span class="p">' + g.pct(p).toFixed(1) + '%</span></li>';
      });
      $('board').innerHTML = html;
    }
    if (S.mini) {
      if (mmDirty) { mmCtx.putImageData(mmImg, 0, 0); mmDirty = false; }
      var mw = mini.width;
      mctx.clearRect(0, 0, mw, mw); mctx.imageSmoothingEnabled = true;
      // v7: מפה ממורכזת עליי – תמונת השטחים נפרשת (4 עותקים) ומוזזת כך שאני תמיד באמצע.
      // אין שחקנים במפה בכלל (לא אימוג'י ולא נקודות) – רק שטחים, וצלב עדין במרכז.
      var ox2 = ((0.5 - (camX / g.W)) % 1 + 1) % 1 * mw, oy2 = ((0.5 - (camY / g.W)) % 1 + 1) % 1 * mw;
      for (var ty = -1; ty <= 0; ty++) for (var tx = -1; tx <= 0; tx++) mctx.drawImage(mm, ox2 + tx * mw, oy2 + ty * mw, mw, mw);
      var mc = mw / 2;
      mctx.strokeStyle = 'rgba(46,52,64,.45)'; mctx.lineWidth = 1.2; mctx.beginPath();
      mctx.moveTo(mc - 6, mc); mctx.lineTo(mc - 2, mc); mctx.moveTo(mc + 2, mc); mctx.lineTo(mc + 6, mc);
      mctx.moveTo(mc, mc - 6); mctx.lineTo(mc, mc - 2); mctx.moveTo(mc, mc + 2); mctx.lineTo(mc, mc + 6); mctx.stroke();
    }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- השהיה / סיום ----------
  function pause(why) {
    if (mode === 'client') { if (state === 'play') show('paused'); return; }   // לקוח: תפריט בלבד, המשחק ממשיך אצל המארח
    if (state !== 'play') return;
    state = 'paused'; stopLoop(); show('paused');
    if (mode === 'host' && MPH) MPH.onPause(why || 'btn');
  }
  function resume() {
    if (mode === 'client') { if (state === 'play') show(MPH && MPH.overlay() ? 'netmsg' : null); return; }
    if (state !== 'paused') return;
    show(null); state = 'play'; acc = 0; startLoop();
    if (mode === 'host' && MPH) MPH.onResume();
  }
  function toMenu() {
    if (mode !== 'solo' && MPH) MPH.leave();
    mode = 'solo'; match = null; $('timer').classList.add('hidden');
    state = 'menu'; stopLoop(); g = null;
    $('hud').classList.add('hidden'); $('joyBase').classList.add('hidden');
    ctx.fillStyle = '#eceff4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    showBest(); show('menu');
  }
  function gameOver(ev) {
    state = 'dying';
    if (S.vib && navigator.vibrate) try { navigator.vibrate(180); } catch (e) {}
    var kills = me.kills, best = me.bestPct;
    if (best > BEST.pct) BEST.pct = best;
    if (kills > BEST.kills) BEST.kills = kills;
    save('kovesh.best', BEST);
    var reasons = { self: 'נגעת בשובל של עצמך', head: 'התנגשות ראש בראש', trail: 'מישהו חצה את השובל שלך', territory: 'כל השטח שלך נכבש' };
    var r = reasons[ev.reason] || '';
    if (ev.killer) r += ' – ' + nm(ev.killer);
    $('overReason').textContent = r;
    $('overAvatar').src = Emoji.dataURL(me.emoji, 160, me.color, lineCss[me.id]);
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
      if (mode === 'client') return;                 // לקוח: המארח ממשיך; אצלנו rAF נעצר לבד
      if (state === 'play') pause('bg');
      if (state === 'dying') { state = 'over'; show('over'); }
      stopLoop();
    }
  });
  window.addEventListener('pagehide', function () { if (state === 'play' && mode !== 'client') pause('bg'); });

  // ---------- קלט ----------
  // חיצים: כיוון מוחלט (כולל אלכסונים, 8 כיוונים); A/D: סיבוב שמאלה/ימינה כל עוד לוחצים
  var HOLD = { ArrowRight: 1, ArrowLeft: 1, ArrowUp: 1, ArrowDown: 1, KeyA: 1, KeyD: 1 };
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter' && state === 'menu') startGame(); return; }
    if (e.code === 'KeyP' || e.key === 'Escape') { if (state === 'play') pause(); else if (state === 'paused') resume(); e.preventDefault(); return; }
    if (e.key === 'Enter' && mode === 'solo' && (state === 'over' || state === 'menu' && !$('menu').classList.contains('hidden'))) { startGame(); return; }
    var c = HOLD[e.code] ? e.code : (HOLD[e.key] ? e.key : null);
    if (c && state === 'play') { keysHeld[c] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { delete keysHeld[e.code]; delete keysHeld[e.key]; });
  window.addEventListener('blur', function () { keysHeld = {}; });

  // גרירה יחסית (ברירת מחדל) / ג'ויסטיק צף – ראו js/input.js. הקלט מוחל מיד על כיוון המטרה,
  // והציור משתמש בכיוון העדכני ביותר, כך שאין המתנה לצעד הבא.
  var touchId = null, joyBase = $('joyBase'), joyKnob = $('joyKnob'), drag = new DragInput(S.sens, S.ctrl);
  function joyRest() {
    joyBase.style.left = (W - 95) + 'px'; joyBase.style.top = (H - 110) + 'px';
    joyKnob.style.transform = ''; joyBase.classList.remove('active');
  }
  function isJoy() { return S.ctrl === 'joy'; }
  function joySetup() { drag.set(S.sens, S.ctrl); drag.setCenter(W / 2, H / 2); joyBase.classList.toggle('hidden', !isJoy()); if (isJoy()) joyRest(); }
  function steer(a) { if (a != null && me && me.alive) { me.target = a; if (mode === 'client' && MPH) MPH.onSteer(a); } }
  function onDown(e) {
    if (state !== 'play' || touchId !== null) return;
    e.preventDefault();
    touchId = e.pointerId; steer(drag.down(e.clientX, e.clientY));
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (isJoy()) { joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px'; joyKnob.style.transform = ''; joyBase.classList.add('active'); }
  }
  function onMove(e) {
    if (state !== 'play') return;
    // עכבר במצב הצבעה: מכוון גם בלי לחיצה (ריחוף)
    if (touchId === null && e.pointerType === 'mouse' && S.ctrl === 'point') { steer(drag.aim(e.clientX, e.clientY)); return; }
    if (e.pointerId !== touchId) return;
    e.preventDefault();
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!list || !list.length) list = [e];
    var a = null;
    for (var i = 0; i < list.length; i++) { var r = drag.move(list[i].clientX, list[i].clientY); if (r != null) a = r; }
    steer(a);
    if (isJoy()) joyKnob.style.transform = 'translate(' + drag.kx + 'px,' + drag.ky + 'px)';
  }
  function endTouch(e) { if (e.pointerId !== touchId) return; touchId = null; drag.up(); if (isJoy()) joyRest(); } // הכיוון האחרון נשמר
  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false }); // מונע גלילה/זום של הדפדפן
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Service Worker (עבודה בלי אינטרנט) ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ממשק למודול הרשת (js/mp.js)
  window.KoveshCore = {
    attach: function (h) { MPH = h; },
    settings: S, save: function () { save('kovesh.settings', S); },
    startMatch: startMatch, addMatchPlayer: addMatchPlayer, endRound: endRound, toMenu: toMenu, show: show, feed: feed,
    effect: function (x, y, color) { effects.push({ x: x, y: y, color: color, t0: performance.now() }); },
    myDeath: myDeath, nm: nm, stopLoop: stopLoop, startLoop: function () { if (state === 'play') startLoop(); },
    setState: function (st) { state = st; }, resize: resize,
    get game() { return g; }, get me() { return me; }, get state() { return state; }, get mode() { return mode; }, get match() { return match; },
    TICK_MS: TICK_MS
  };
  // חשיפה לבדיקות אוטומטיות בלבד
  window.__kovesh = { get frames() { return frames; }, get game() { return g; }, get me() { return me; }, get state() { return state; }, get cam() { return [camX, camY]; }, start: startGame, pause: pause };
})();
