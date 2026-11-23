"""Araba görsellerini oyuna hazırlar.

Kullanım:
    python3 tools/araba_hazirla.py

img/kaynak/araclar/<tür>-<on|arka>.png dosyalarını okur:
  on   = sağ-aşağı giden araba (önü ve sağ yanı görünür)
  arka = sağ-yukarı giden araba (arkası ve sağ yanı görünür)
Sola giden yönler oyunda aynalanarak çizilir.

Yaptıkları:
1. Pembe/mor arka planı (ve üstündeki koyu pembe gölgeyi) renk tonuna bakarak siler.
2. Yalnız en büyük parçayı bırakır, kenarı yumuşatır, boşlukları kırpar.
3. 160 piksel genişliğe küçültüp img/araclar/<tür>-<yön>.png olarak kaydeder.

Gerekenler: Python 3, Pillow ve numpy.
"""
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from gorsel_hazirla import keep_largest

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'img' / 'kaynak' / 'araclar'
OUT = ROOT / 'img' / 'araclar'
WIDTH = 160


def magenta_mask(a):
    """Arka plan (pembe-mor) pikselleri: ton 285°-350°, doygun."""
    rgb = a[..., :3].astype(np.float32) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return (hue >= 285) & (hue <= 350) & (sat > 0.3) & (mx > 0.25)


def process(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    bg = magenta_mask(a)
    mask = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    mask = keep_largest(mask)
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))  # küçük delikleri kapat
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    # kenarda kalan pembe ışıltıyı griye çek
    a = np.array(im).astype(np.float32)
    edge = (a[..., 3] > 0) & (a[..., 3] < 250) | magenta_mask(a.astype(np.uint8))
    grey = a[..., :3].mean(-1, keepdims=True)
    a[..., :3] = np.where(edge[..., None], grey * 0.9, a[..., :3])
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    h = round(im.height * WIDTH / im.width)
    return im.resize((WIDTH, h), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    for p in sorted(SRC.glob('*-*.png')):
        out = process(p)
        out.save(OUT / p.name, optimize=True)
        print(p.stem, out.size)


if __name__ == '__main__':
    main()
