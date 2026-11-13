#!/usr/bin/env python3
"""v9.17: בונה את לוגו Emojiverse כ-SVG עצמאי (בלי גופן חיצוני) -> icons/logo.svg + הטמעה ב-index.html.
האותיות: קווי מתאר מהגופן Nunito (רישיון SIL OFL, מותר להמיר לקווי מתאר), משקל 850.
ה-o: כוכב-אימוג'י מחייך עם טבעת מסלול, והניצוצות – מצוירים כאן בקוד.
הרצה: /home/box/factory/tools/.venv/bin/python tools/make_logo.py"""
import os, re
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = '/usr/share/fonts/truetype/sand-box/google/Nunito/Nunito-VariableFont_wght.ttf'
f = instantiateVariableFont(TTFont(FONT), {'wght': 850})
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
XH, BASE, TRACK = 484, 760, 6          # גובה x, קו בסיס, ריווח אותיות

def glyph(ch, x):
    name = cmap[ord(ch)]
    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, BASE)))
    return pen.getCommands(), hmtx[name][0]

paths, x = [], 30
for ch in 'Em':
    d, adv = glyph(ch, x); paths.append(d); x += adv + TRACK
# ה-o: כוכב-אימוג'י
o_adv = hmtx[cmap[ord('o')]][0]
r = XH * 0.56
cx, cy = x + o_adv / 2, BASE - XH / 2 + 4
x += o_adv + TRACK
for ch in 'jiverse':
    d, adv = glyph(ch, x); paths.append(d); x += adv + TRACK
text_end = x
W = int(text_end + 250); VH = BASE + 225

def f1(v): return ('%.1f' % v).rstrip('0').rstrip('.')
def star(sx, sy, s):   # ניצוץ 4 קצוות ✦
    k = s * 0.22
    return (f'M{f1(sx)} {f1(sy-s)}Q{f1(sx+k)} {f1(sy-k)} {f1(sx+s)} {f1(sy)}Q{f1(sx+k)} {f1(sy+k)} {f1(sx)} {f1(sy+s)}'
            f'Q{f1(sx-k)} {f1(sy+k)} {f1(sx-s)} {f1(sy)}Q{f1(sx-k)} {f1(sy-k)} {f1(sx)} {f1(sy-s)}Z')

# טבעת מסלול: אליפסה מוטה; החצי האחורי מאחורי הכוכב, הקדמי מלפניו
rx, ry, rot = r * 1.55, r * 0.42, -16
ring_back = f'M{f1(cx-rx)} {f1(cy)}A{f1(rx)} {f1(ry)} 0 0 1 {f1(cx+rx)} {f1(cy)}'
ring_front = f'M{f1(cx+rx)} {f1(cy)}A{f1(rx)} {f1(ry)} 0 0 1 {f1(cx-rx)} {f1(cy)}'
import math
a = math.radians(128); dx, dy = rx * math.cos(a), ry * math.sin(a)   # נקודה ורודה על החלק הקדמי
t = math.radians(rot); px, py = cx + dx*math.cos(t) - dy*math.sin(t), cy + dx*math.sin(t) + dy*math.cos(t)
ex = r * 0.36
sparkles = star(text_end + 95, 250, 105) + star(text_end + 10, 125, 42) + star(text_end + 190, 95, 34)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {VH}" role="img" aria-label="Emojiverse">
<defs>
<linearGradient id="evT" gradientUnits="userSpaceOnUse" x1="0" y1="{BASE-720}" x2="0" y2="{BASE+40}"><stop offset="0" stop-color="#6c7fa0"/><stop offset=".55" stop-color="#4f5f7e"/><stop offset="1" stop-color="#3b4760"/></linearGradient>
<radialGradient id="evP" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#ffd66e"/><stop offset="1" stop-color="#eda863"/></radialGradient>
</defs>
<g fill="url(#evT)">{''.join(f'<path d="{d}"/>' for d in paths)}</g>
<g fill="none" stroke="#7d74b4" stroke-width="17" stroke-linecap="round" transform="rotate({rot} {f1(cx)} {f1(cy)})"><path d="{ring_back}" opacity=".55"/></g>
<circle cx="{f1(cx)}" cy="{f1(cy)}" r="{f1(r)}" fill="url(#evP)"/>
<g fill="#e9b26f" opacity=".55"><circle cx="{f1(cx-r*.45)}" cy="{f1(cy-r*.5)}" r="{f1(r*.16)}"/><circle cx="{f1(cx+r*.5)}" cy="{f1(cy-r*.38)}" r="{f1(r*.1)}"/><circle cx="{f1(cx+r*.12)}" cy="{f1(cy+r*.62)}" r="{f1(r*.12)}"/></g>
<g fill="#f59a9a" opacity=".6"><ellipse cx="{f1(cx-r*.58)}" cy="{f1(cy+r*.22)}" rx="{f1(r*.17)}" ry="{f1(r*.11)}"/><ellipse cx="{f1(cx+r*.58)}" cy="{f1(cy+r*.22)}" rx="{f1(r*.17)}" ry="{f1(r*.11)}"/></g>
<g fill="none" stroke="#4a3b35" stroke-width="{f1(r*.11)}" stroke-linecap="round">
<path d="M{f1(cx-ex-r*.13)} {f1(cy-r*.05)}q{f1(r*.13)} {f1(-r*.17)} {f1(r*.26)} 0"/><path d="M{f1(cx+ex-r*.13)} {f1(cy-r*.05)}q{f1(r*.13)} {f1(-r*.17)} {f1(r*.26)} 0"/>
<path d="M{f1(cx-r*.3)} {f1(cy+r*.2)}q{f1(r*.3)} {f1(r*.32)} {f1(r*.6)} 0"/></g>
<g fill="none" stroke="#7d74b4" stroke-width="17" stroke-linecap="round" transform="rotate({rot} {f1(cx)} {f1(cy)})"><path d="{ring_front}"/></g>
<circle cx="{f1(px)}" cy="{f1(py)}" r="27" fill="#f27fa8" stroke="#fff" stroke-width="7"/>
<path fill="#5d7096" d="{sparkles}"/>
</svg>'''
svg = re.sub(r'(\d)\.(\d)\d+', r'\1.\2', svg)   # קיצור מספרים
os.makedirs(os.path.join(ROOT, 'icons'), exist_ok=True)
open(os.path.join(ROOT, 'icons', 'logo.svg'), 'w').write(svg + '\n')
# הטמעה בתוך index.html (בין הסמנים) – עובד גם בלי רשת וגם בלי בקשה נוספת
ip = os.path.join(ROOT, 'index.html'); html = open(ip).read()
inline = svg.replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg class="logosvg" xmlns="http://www.w3.org/2000/svg"', 1).replace('role="img" aria-label="Emojiverse"', 'aria-hidden="true" focusable="false"')
html2, n = re.subn(r'<!--LOGO-->.*?<!--/LOGO-->', lambda m: '<!--LOGO-->' + inline.replace('\n', '') + '<!--/LOGO-->', html, flags=re.S)
if n: open(ip, 'w').write(html2)
print('logo.svg', len(svg), 'bytes; viewBox', W, 'x', VH, '; inline', 'updated' if n else 'marker not found')
