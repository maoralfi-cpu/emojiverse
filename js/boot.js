/* Emojiverse – בדיקת אתחול: אם הקוד לא עלה תוך כמה שניות, או שנזרקה שגיאה – מציגים הודעה ברורה במקום מסך תקוע. */
(function () {
  var errs = [];
  function box() { return document.getElementById('bootFail'); }
  function show() {
    var b = box(); if (!b) return;
    b.className = 'bootfail';
    var e = document.getElementById('bootErr');
    if (e && errs.length) e.textContent = errs.slice(-3).join('\n');
  }
  window.onerror = function (msg, src, line, col) {
    errs.push(String(msg) + (src ? ' @ ' + String(src).split('/').pop() + ':' + line + ':' + (col || 0) : ''));
    if (!window.__evBooted) show(); else { var e = document.getElementById('bootErr'); if (e) e.textContent = errs.slice(-3).join('\n'); }
    return false;
  };
  window.addEventListener && window.addEventListener('unhandledrejection', function (ev) {
    errs.push('promise: ' + (ev && ev.reason && (ev.reason.message || ev.reason)));
  });
  setTimeout(function () { if (!window.__evBooted) { errs.push('boot timeout'); show(); } }, 6000);
})();
