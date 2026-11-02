/* Emojiverse – בדיקת אתחול: אם הקוד לא עלה תוך כמה שניות, או שנזרקה שגיאה – מציגים הודעה ברורה במקום מסך תקוע. */
(function () {
  var errs = [];
  var V = window.EV_VERSION || { app: '', build: '' };
  function tag() { var t = document.getElementById('verTag'); if (t) t.textContent = V.app; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tag); else tag();
  function box() { return document.getElementById('bootFail'); }
  function show() {
    var b = box(); if (!b || window.__evBooted) return;
    b.className = 'bootfail';
    var e = document.getElementById('bootErr');
    if (e && errs.length) e.textContent = errs.slice(-3).join('\n');
  }
  window.onerror = function (msg, src, line, col) {
    errs.push(String(msg) + (src ? ' @ ' + String(src).split('/').pop() + ':' + line + ':' + (col || 0) : ''));
    if (!window.__evBooted) setTimeout(function () { if (!window.__evBooted) show(); }, 1500); // שגיאה אמיתית לפני האתחול
    return false;
  };
  window.addEventListener && window.addEventListener('unhandledrejection', function (ev) {
    errs.push('promise: ' + (ev && ev.reason && (ev.reason.message || ev.reason)));
  });
  // בדיקת תצוגה: אם התפריט לא נראה בפועל (פריסה שבורה בדפדפן מסוים) – עוברים לפריסה פשוטה ובטוחה
  function diag() {
    var m = document.getElementById('menu'), c = m && m.querySelector('.card');
    var r = c ? c.getBoundingClientRect() : null, vw = window.innerWidth, vh = window.innerHeight;
    return { r: r, vw: vw, vh: vh, ok: !!(r && r.width > 40 && r.height > 40 && r.right > 10 && r.left < vw - 10 && r.bottom > 10 && r.top < vh - 10) };
  }
  function check() {
    var m = document.getElementById('menu');
    if (!m || m.classList.contains('hidden')) return;
    var d = diag();
    if (!d.ok) { document.documentElement.className += ' safe'; errs.push('layout fallback ' + JSON.stringify(d.r) + ' ' + d.vw + 'x' + d.vh); }
  }
  setTimeout(check, 1500);
  // ?diag – פאנל אבחון ניטרלי ונפרד (לא הודעת "לא נתמך")
  function diagText() {
    var d = diag();
    return 'version ' + V.app + ' build ' + V.build + '\nUA: ' + navigator.userAgent + '\nview ' + d.vw + 'x' + d.vh + ' dpr ' + window.devicePixelRatio + '\ncard ' + JSON.stringify(d.r) + '\nbooted ' + !!window.__evBooted + ' sw ' + !!(navigator.serviceWorker && navigator.serviceWorker.controller) + ' standalone ' + !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) + '\nnet ' + JSON.stringify(window.__evNet || {}) + ' rtc ' + !!window.RTCPeerConnection + '\nerrors: ' + (errs.join(' | ') || 'none');
  }
  if (/[?&]diag/.test(location.search)) setTimeout(function () {
    var p = document.getElementById('diagBox'), t = document.getElementById('diagText'); if (!p || !t) return;
    p.className = 'diagbox'; t.textContent = diagText();
    p.onclick = function () { p.className = 'hidden'; };
    setInterval(function () { if (p.className === 'diagbox') t.textContent = diagText(); }, 2000);
  }, 3000);
  // הודעת "לא נתמך" רק אם המשחק באמת לא עלה (שגיאה לפני האתחול, או 15 שניות בלי אתחול). אחרי booted – אף פעם.
  var waited = 0;
  var bootT = setInterval(function () {
    if (window.__evBooted) { clearInterval(bootT); return; }
    if (document.visibilityState === 'hidden') return;        // טאב ברקע / PWA מוקפא – לא סופרים
    waited += 1000;
    if (waited >= 15000) { clearInterval(bootT); errs.push('boot timeout'); show(); }
  }, 1000);
})();
