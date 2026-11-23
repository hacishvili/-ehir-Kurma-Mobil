"""Bina görselini oyuna hazırlar.

Kullanım:
    python3 tools/gorsel_hazirla.py img/kaynak/ev.png ev

Yaptıkları:
1. Düz renkli (siyah ya da beyaz) arka planı şeffaf yapar. Kenardan başlayıp
   arka plan rengine benzeyen pikselleri siler; binanın içindeki koyu yerlere dokunmaz.
   Görsel zaten şeffafsa bu adım atlanır.
2. Boş kenarları kırpar.
3. Açıyı oyunun karelerine uydurur. Yapay zekâ çoğu zaman oyunun karelerinden
   daha dik açıdan çizer (zemin baklavası oranı ~1,6-1,75; oyunun kareleri 2:1).
   Oran görselden ölçülür ve görsel dikeyde basılarak baklava 2:1'e getirilir.
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
    # arka plan rengi: kenar piksellerinde en sık görülen renk (köşede leke olsa da şaşmaz)
    from collections import Counter
    border = [px[x, 0][:3] for x in range(0, w, 4)] + [px[x, h - 1][:3] for x in range(0, w, 4)]
    border += [px[0, y][:3] for y in range(0, h, 4)] + [px[w - 1, y][:3] for y in range(0, h, 4)]
    ref = Counter((r // 8 * 8, g // 8 * 8, b // 8 * 8) for r, g, b in border).most_common(1)[0][0]

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
    mask = keep_largest(mask)
    # kenardaki arka plan rengine bulaşmış pikselleri at, kenarı yumuşat
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    return im


def keep_largest(mask):
    """Yalnız en büyük parçayı bırakır; köşedeki leke ve kırıntıları siler."""
    w, h = mask.size
    m = mask.load()
    seen = bytearray(w * h)
    best = []
    for sy in range(0, h, 3):
        for sx in range(0, w, 3):
            if m[sx, sy] < 128 or seen[sy * w + sx]:
                continue
            comp, q = [], [(sx, sy)]
            seen[sy * w + sx] = 1
            while q:
                x, y = q.pop()
                comp.append(y * w + x)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and m[nx, ny] >= 128:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    out = bytearray(w * h)
    for i in best:
        out[i] = 255
    return Image.frombytes('L', (w, h), bytes(out))


def measure(im):
    """Zemin baklavasının oranını (genişlik/yükseklik) ölçer.

    Görselin alt kenarı, zeminin sol-alt ve sağ-alt kenarlarıdır; ağaç ya da çit
    bunları bozmaz. Bu iki kenarın eğimi baklavanın oranını verir.
    """
    a = im.getchannel('A').load()
    w, h = im.size

    def bottom(x):
        return max((y for y in range(h) if a[x, y] > 128), default=None)

    slopes = []
    for lo, hi in ((0.12, 0.40), (0.60, 0.88)):
        xs = [round(w * (lo + (hi - lo) * i / 20)) for i in range(21)]
        pts = [(x, bottom(x)) for x in xs if bottom(x) is not None]
        n = len(pts)
        mx = sum(p[0] for p in pts) / n
        my = sum(p[1] for p in pts) / n
        sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
        sxx = sum((p[0] - mx) ** 2 for p in pts)
        slopes.append(abs(sxy / sxx))
    slope = sum(slopes) / 2
    return 1 / slope if slope else math.sqrt(3), slopes

def main():
    ap = argparse.ArgumentParser(description='Bina görselini oyuna hazırlar.')
    ap.add_argument('kaynak', help='Üretilen görsel (png, webp, jpg)')
    ap.add_argument('ad', help='Bina türü, örnek: ev, kafe, atolye')
    ap.add_argument('--oran', type=float, default=None,
                    help='Kaynaktaki zemin baklavasının genişlik/yükseklik oranı (verilmezse ölçülür)')
    ap.add_argument('--tolerans', type=int, default=22, help='Arka plan rengine ne kadar benzeyen silinsin')
    ap.add_argument('--genislik', type=int, default=512)
    args = ap.parse_args()
    # img/kaynak/ayarlar.json: bazı görsellerin kendine özel ayarı (örn. market için tolerans)
    import json
    settings_file = ROOT / 'img' / 'kaynak' / 'ayarlar.json'
    if settings_file.exists():
        own = json.loads(settings_file.read_text()).get(args.ad, {})
        if 'tolerans' in own and args.tolerans == 22:
            args.tolerans = own['tolerans']
        if 'oran' in own and args.oran is None:
            args.oran = own['oran']

    im = remove_background(Image.open(args.kaynak), args.tolerans)
    bbox = im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    im = im.crop(bbox)
    measured, slopes = measure(im)
    w, h = im.size
    ratio = args.oran or measured
    print(f'Kırpılmış boyut {w}x{h}; zemin kenar eğimleri {slopes[0]:.3f} / {slopes[1]:.3f}, '
          f'ölçülen oran {measured:.2f}')
    if abs(slopes[0] - slopes[1]) > 0.06:
        print('Uyarı: sol ve sağ kenar eğimi farklı; görsel tam izometrik olmayabilir.')
    if not 1.4 <= ratio <= 2.2:
        print('Uyarı: oran beklenmedik; görseli kontrol et ya da --oran ver.')
    squash = ratio / 2.0
    new_w = args.genislik
    new_h = round(h * (new_w / w) * squash)
    out = im.resize((new_w, new_h), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / f'{args.ad}.png'
    out.save(dest, optimize=True)
    print(f'Kaydedildi: {dest.relative_to(ROOT)} ({new_w}x{new_h}, dikey basma {squash:.3f})')


if __name__ == '__main__':
    main()
