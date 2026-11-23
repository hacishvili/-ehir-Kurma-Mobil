"""Bina görselini oyuna hazırlar.

Kullanım:
    python3 tools/gorsel_hazirla.py img/kaynak/ev.webp ev

Yaptıkları:
1. Düz renkli (siyah ya da beyaz) arka planı şeffaf yapar. Kenardan başlayıp
   arka plan rengine benzeyen pikselleri siler; binanın içindeki koyu yerlere dokunmaz.
   Görsel zaten şeffafsa bu adım atlanır.
2. Boş kenarları kırpar.
3. Açıyı oyunun karelerine uydurur. Yapay zekâ çoğu zaman "gerçek izometrik"
   çizer (zemin baklavası genişliğinin yüksekliğine oranı ~1,73); oyunun kareleri 2:1.
   Görsel dikeyde biraz basılarak baklava 2:1'e getirilir.
4. 512 piksel genişliğe küçültüp img/binalar/<ad>.png olarak kaydeder.

Gerekenler: Python 3 ve Pillow (pip install pillow).
"""
import argparse
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'img' / 'binalar'


def remove_background(im, tolerance):
    im = im.convert('RGBA')
    w, h = im.size
    alpha = im.getchannel('A')
    if alpha.getextrema()[0] < 250:
        return im  # zaten şeffaf
    px = im.load()
    ref = px[0, 0][:3]

    def is_bg(c):
        return max(abs(c[0] - ref[0]), abs(c[1] - ref[1]), abs(c[2] - ref[2])) <= tolerance

    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.pop()
        i = y * w + x
        if bg[i] or not is_bg(px[x, y]):
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    mask = Image.frombytes('L', (w, h), bytes(0 if v else 255 for v in bg))
    # kenardaki arka plan rengine bulaşmış pikselleri at, kenarı yumuşat
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    return im


def measure(im):
    """Zemin baklavasının sol köşesinin ve alt ucunun yüksekliğini bulur."""
    a = im.getchannel('A').load()
    w, h = im.size
    left_y = next(y for y in range(h) if a[1, y] > 128)
    bottom_y = max(y for y in range(h) if a[w // 2, y] > 128)
    return left_y, bottom_y


def main():
    ap = argparse.ArgumentParser(description='Bina görselini oyuna hazırlar.')
    ap.add_argument('kaynak', help='Üretilen görsel (png, webp, jpg)')
    ap.add_argument('ad', help='Bina türü, örnek: ev, kafe, atolye')
    ap.add_argument('--oran', type=float, default=math.sqrt(3),
                    help='Kaynaktaki zemin baklavasının genişlik/yükseklik oranı (varsayılan 1,73)')
    ap.add_argument('--tolerans', type=int, default=22, help='Arka plan rengine ne kadar benzeyen silinsin')
    ap.add_argument('--genislik', type=int, default=512)
    args = ap.parse_args()

    im = remove_background(Image.open(args.kaynak), args.tolerans)
    bbox = im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    im = im.crop(bbox)
    left_y, bottom_y = measure(im)
    w, h = im.size
    print(f'Kırpılmış boyut {w}x{h}; zemin sol köşesi y={left_y}, alt uç y={bottom_y}')

    squash = args.oran / 2.0
    new_w = args.genislik
    new_h = round(h * (new_w / w) * squash)
    out = im.resize((new_w, new_h), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / f'{args.ad}.png'
    out.save(dest, optimize=True)
    print(f'Kaydedildi: {dest.relative_to(ROOT)} ({new_w}x{new_h}, dikey basma {squash:.3f})')


if __name__ == '__main__':
    main()
