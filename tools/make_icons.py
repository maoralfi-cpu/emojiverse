# יוצר את אייקוני Emojiverse (ציור מקורי בקוד: כוכב-לכת סמיילי עם טבעת מסלול ונקודות שטח)
import os, base64
from playwright.sync_api import sync_playwright
JS = r"""(args) => { const [S, mask] = args; const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
 const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#d9e6f2'); g.addColorStop(1, '#ecdcea');
 x.fillStyle = g; if (mask) x.fillRect(0, 0, S, S); else { x.beginPath(); x.roundRect(0, 0, S, S, S * .22); x.fill(); }
 const k = mask ? .78 : 1, cx = S / 2, cy = S / 2, R = S * .27 * k;
 x.save(); x.translate(cx, cy); x.rotate(-0.35);
 // טבעת – חצי אחורי
 x.lineWidth = S * .035 * k; x.strokeStyle = '#5e81ac'; x.beginPath(); x.ellipse(0, 0, R * 1.62, R * .5, 0, Math.PI, 2 * Math.PI); x.stroke();
 x.restore();
 // כוכב
 const pg = x.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); pg.addColorStop(0, '#fff3c4'); pg.addColorStop(1, '#ebcb8b');
 x.fillStyle = pg; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
 // "שטחים" על הכוכב
 x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip();
 x.fillStyle = 'rgba(163,190,140,.75)'; x.beginPath(); x.ellipse(cx - R * .55, cy + R * .55, R * .5, R * .32, .4, 0, 7); x.fill();
 x.fillStyle = 'rgba(180,142,173,.7)'; x.beginPath(); x.ellipse(cx + R * .65, cy - R * .6, R * .42, R * .3, -.5, 0, 7); x.fill();
 x.restore();
 // פרצוף
 x.fillStyle = '#3b4252'; x.beginPath(); x.ellipse(cx - R * .33, cy - R * .12, R * .1, R * .15, 0, 0, 7); x.ellipse(cx + R * .33, cy - R * .12, R * .1, R * .15, 0, 0, 7); x.fill();
 x.strokeStyle = '#3b4252'; x.lineWidth = R * .09; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy + R * .05, R * .42, .2 * Math.PI, .8 * Math.PI); x.stroke();
 x.fillStyle = 'rgba(208,135,112,.5)'; x.beginPath(); x.arc(cx - R * .58, cy + R * .2, R * .11, 0, 7); x.arc(cx + R * .58, cy + R * .2, R * .11, 0, 7); x.fill();
 // טבעת – חצי קדמי + נקודות
 x.save(); x.translate(cx, cy); x.rotate(-0.35);
 x.lineWidth = S * .035 * k; x.strokeStyle = '#5e81ac'; x.beginPath(); x.ellipse(0, 0, R * 1.62, R * .5, 0, 0, Math.PI); x.stroke();
 [['#bf616a', .35], ['#a3be8c', 1.4], ['#b48ead', 2.6]].forEach(([col, a]) => { x.fillStyle = col; x.beginPath(); x.arc(Math.cos(a) * R * 1.62, Math.sin(a) * R * .5, S * .04 * k, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = S * .01; x.stroke(); });
 x.restore();
 return c.toDataURL('image/png'); }"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(); pg.goto('about:blank')
    for name, S, m in [('icon-192', 192, False), ('icon-512', 512, False), ('maskable-192', 192, True), ('maskable-512', 512, True)]:
        d = pg.evaluate(JS, [S, m]); open(f'icons/{name}.png', 'wb').write(base64.b64decode(d.split(',')[1]))
    b.close()
