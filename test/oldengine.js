var f = document.getElementById('f'), out = document.getElementById('out'), errs = [];
f.addEventListener('load', function () {
  var w = f.contentWindow; w.addEventListener('error', function (e) { errs.push(String(e.message)); });
  setTimeout(function () {
    try { w.document.getElementById('playBtn').click(); } catch (e) { errs.push('click ' + e); }
    setTimeout(function () {
      var k = w.__kovesh; out.textContent = 'RESULT state=' + (k && k.state) + ' frames=' + (k && k.frames) + ' tick=' + (k && k.game && k.game.tickNo) + ' errors=' + JSON.stringify(errs);
    }, 2500);
  }, 800);
});
