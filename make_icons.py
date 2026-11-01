#!/usr/bin/env python3
"""מייצר את אייקוני האפליקציה (מקוריים) עם PIL: python3 make_icons.py"""
from PIL import Image, ImageDraw
import os
os.makedirs('icons', exist_ok=True)

def icon(size, maskable):
    S = 4 * size  # ציור בהגדלה ואז הקטנה לקצוות חלקים
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle([0, 0, S, S], fill=(91, 61, 245))
        pad = int(S * 0.18)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=(91, 61, 245))
        pad = int(S * 0.12)
    inner = S - 2 * pad
    cell = inner / 8
    # רשת משבצות בהירה
    for y in range(8):
        for x in range(8):
            c = (240, 242, 251) if (x + y) % 2 == 0 else (226, 229, 245)
            d.rectangle([pad + x * cell, pad + y * cell, pad + (x + 1) * cell, pad + (y + 1) * cell], fill=c)
    # שטח ורוד ושטח טורקיז + שובל
    def blk(x0, y0, x1, y1, col):
        d.rectangle([pad + x0 * cell, pad + y0 * cell, pad + x1 * cell, pad + y1 * cell], fill=col)
    blk(0, 0, 4, 4, (255, 95, 162))
    blk(5, 5, 8, 8, (22, 185, 120))
    blk(4, 1, 7, 2, (255, 180, 210)); blk(6, 2, 7, 4, (255, 180, 210))
    # ראש עגול עם עיניים
    cx, cy, r = pad + 6.5 * cell, pad + 4.0 * cell, cell * 1.05
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255), outline=(255, 95, 162), width=int(cell * 0.25))
    for sx in (-1, 1):
        ex, ey = cx + sx * r * 0.38, cy + r * 0.05
        d.ellipse([ex - r * 0.2, ey - r * 0.3, ex + r * 0.2, ey + r * 0.3], fill=(40, 30, 60))
        d.ellipse([ex - r * 0.1, ey - r * 0.22, ex + r * 0.02, ey - r * 0.06], fill=(255, 255, 255))
    return im.resize((size, size), Image.LANCZOS)

for s in (192, 512):
    icon(s, False).save(f'icons/icon-{s}.png')
    icon(s, True).save(f'icons/maskable-{s}.png')
print('icons ok')
