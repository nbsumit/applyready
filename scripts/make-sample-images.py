#!/usr/bin/env python3
"""Synthetic test images used for the measurements quoted on ApplyReady pages.

No real person or real signature is shown. The images imitate what the tools usually receive:
a phone portrait against a plain wall and a phone photo of a signature on paper, both with
sensor-like noise and saved as JPEG the way a phone camera would. Re-running this script
produces the same files (fixed random seed), so every measurement can be reproduced.

    python3 scripts/make-sample-images.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / 'img' / 'samples'
random.seed(2026)


def add_noise(img, sigma):
    """Per-pixel Gaussian noise, the main reason real photos compress worse than drawings."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            n = random.gauss(0, sigma)
            px[x, y] = (max(0, min(255, int(r + n))), max(0, min(255, int(g + n * 0.9))), max(0, min(255, int(b + n * 1.1))))
    return img


def portrait(name='test-portrait.jpg', wall=(226, 232, 238), shirt=(38, 52, 84), skin=(214, 168, 136), hair=(34, 26, 22), out=None):
    w, h = 1200, 1600
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):  # plain, slightly uneven wall
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(wall[0] - 18 * t), int(wall[1] - 16 * t), int(wall[2] - 10 * t)))
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([110, 1180, 1090, 2100], fill=shirt + (255,))       # shoulders, dark shirt
    ld.polygon([(520, 1180), (600, 1330), (680, 1180)], fill=(236, 236, 240, 255))  # collar
    ld.rectangle([520, 1010, 680, 1220], fill=(196, 150, 120, 255))   # neck
    ld.ellipse([380, 420, 820, 1080], fill=skin + (255,))      # face
    ld.ellipse([360, 330, 840, 720], fill=hair + (255,))          # hair
    ld.ellipse([400, 520, 800, 760], fill=skin + (255,))       # forehead over hair
    for ex in (500, 700):                                             # eyes and brows
        ld.ellipse([ex - 42, 700, ex + 42, 740], fill=(250, 248, 246, 255))
        ld.ellipse([ex - 17, 703, ex + 17, 737], fill=(58, 40, 30, 255))
        ld.line([(ex - 50, 670), (ex + 50, 664)], fill=(48, 34, 28, 255), width=10)
    ld.line([(600, 740), (588, 860), (612, 868)], fill=(170, 124, 98, 255), width=7)  # nose
    ld.arc([530, 880, 670, 960], 15, 165, fill=(150, 82, 78, 255), width=9)          # mouth
    ld.ellipse([360, 760, 400, 860], fill=(204, 158, 126, 255))       # ears
    ld.ellipse([800, 760, 840, 860], fill=(204, 158, 126, 255))
    layer = layer.filter(ImageFilter.GaussianBlur(3))
    shade = Image.new('L', (w, h), 0)                                 # soft light from the left
    sd = ImageDraw.Draw(shade)
    for x in range(w):
        sd.line([(x, 0), (x, h)], fill=int(40 * x / w))
    img.paste(layer, (0, 0), layer)
    img = Image.composite(Image.new('RGB', (w, h), (0, 0, 0)), img, shade.point(lambda v: v // 2))
    img = add_noise(img, 4.0)
    img.save((out or OUT) / name, 'JPEG', quality=92)


def signature():
    w, h = 1600, 900
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):  # white paper photographed under a lamp: one corner darker
        for x in range(0, w, 4):
            v = 236 - int(30 * math.hypot(x - w, y - h) / math.hypot(w, h) * 0)  # base
            v = int(240 - 28 * (x / w) * (y / h))
            d.line([(x, y), (x + 3, y)], fill=(v, v - 2, v - 8))
    pen = (24, 34, 92)
    pts = []
    for i in range(900):  # one running-hand stroke: loops on a slowly rising baseline
        t = i / 899
        x = 220 + 1100 * t
        y = 520 - 120 * t + 110 * math.sin(t * 9 * math.pi) * (0.6 + 0.4 * math.sin(t * 3))
        x += 55 * math.cos(t * 18 * math.pi) * (t < 0.8)
        pts.append((x, y))
    for i in range(len(pts) - 1):
        width = 7 + int(3 * math.sin(i / 40))
        d.line([pts[i], pts[i + 1]], fill=pen, width=width)
    d.line([(300, 640), (1260, 600)], fill=pen, width=6)  # underline flourish
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img = add_noise(img, 3.0)
    img.save(OUT / 'test-signature.jpg', 'JPEG', quality=92)


def document_page(name, lines, seed_shift=0):
    """A phone photo of a printed A4 page: off-white paper on a darker desk, a heading band and
    rows of grey bars standing in for typed text. No real document is shown."""
    w, h = 1240, 1754
    img = Image.new('RGB', (w, h), (92, 84, 74))                      # desk around the page
    d = ImageDraw.Draw(img)
    d.rectangle([40, 50, w - 40, h - 40], fill=(244, 241, 232))       # the sheet
    d.rectangle([140, 150, w - 140, 230], fill=(60, 72, 110))         # heading band
    y = 300
    for i in range(lines):
        width = random.randint(560, 960)
        d.rectangle([140, y, 140 + width, y + 16], fill=(84, 84, 90))
        y += 46 if (i + 1) % 6 else 92
    d.ellipse([w - 360, h - 380, w - 160, h - 180], outline=(150, 40, 40), width=8)  # a round seal
    d.line([(160, h - 220), (520, h - 250)], fill=(24, 34, 92), width=6)            # a signature stroke
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    img = add_noise(img, 3.0)
    img.save(OUT / 'guide' / name, 'JPEG', quality=90)


def guide_samples():
    """Extra inputs for the step-by-step tutorials (scripts/guide-screenshots.js). They live in
    img/samples/guide/, which the offline cache does not include."""
    (OUT / 'guide').mkdir(parents=True, exist_ok=True)
    portrait('photo-applicant-1.jpg', wall=(236, 236, 230), shirt=(120, 40, 46), out=OUT / 'guide')
    portrait('photo-applicant-2.jpg', wall=(214, 226, 240), shirt=(30, 90, 80), skin=(180, 130, 100), out=OUT / 'guide')
    portrait('photo-applicant-3.jpg', wall=(240, 238, 244), shirt=(70, 70, 76), hair=(60, 40, 30), out=OUT / 'guide')
    document_page('document-page-1.jpg', 22)
    document_page('document-page-2.jpg', 30)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    portrait()
    signature()
    guide_samples()
    for f in sorted(list(OUT.glob('test-*.jpg')) + list((OUT / 'guide').glob('*.jpg'))):
        im = Image.open(f)
        print(f.relative_to(OUT), im.size, f.stat().st_size, 'bytes')
