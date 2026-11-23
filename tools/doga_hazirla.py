"""Doğa görsellerini oyuna hazırlar (zemin dokuları ve tek başına ağaçlar).

Kullanım:
    python3 tools/doga_hazirla.py

img/kaynak/doga/ içindeki görselleri işler, img/doga/ altına yazar:
- Zemin dokuları (cim, yabani): 512 px, kenarları dikişsiz birleşecek şekilde harmanlanır
  (yarım kaydırılmış kopya kenarlarda öne geçer), renk ayarı yapılır.
- Ağaç, çalı, kaya, çiçek: düz (beyaz ya da siyah) arka plan silinir, gölge silinir
  (gölgeyi oyun kendisi çizer), kırpılır, 256 px genişliğe küçültülür.
"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageChops

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'img' / 'kaynak' / 'doga'
OUT = ROOT / 'img' / 'doga'
sys.path.insert(0, str(ROOT / 'tools'))
from gorsel_hazirla import remove_background  # noqa: E402

TEXTURES = {  # ad: (doygunluk, parlaklık, renk tonu kaydırma [r, g, b])
    'cim': (0.78, 0.86, (-26, -2, 0)),
    'yabani': (1.05, 1.38, (0, 8, 0)),
    'kar': (0.9, 1.0, (0, 0, 0)),
    'sonbahar': (0.72, 0.98, (0, 4, 0)),
}
SPRITES = {'mese': 40, 'kuknar': 40, 'kavak': 40, 'yaprakli': 40, 'cali': 30, 'camlar': 40,
           'cicekler': 30, 'kaya': 40,
           # mevsim görünümleri (karlı dallar beyaz olduğu için kar ağaçlarında tolerans düşük)
           'kuknar-kar': 14, 'camlar-kar': 14, 'yaprakli-sonbahar': 40, 'mese-sonbahar': 40,
           'kavak-sonbahar': 40, 'mese-kis': 30}


def seamless(im):
    w, h = im.size
    rolled = ImageChops.offset(im, w // 2, h // 2)
    mask = Image.new('L', (w, h))
    px = mask.load()
    for y in range(h):
        dy = min(y, h - 1 - y) / (h / 2)
        for x in range(w):
            dx = min(x, w - 1 - x) / (w / 2)
            v = min(dx, dy)  # kenarda 0, ortada 1
            px[x, y] = int(255 * min(1, v * 2.2))
    return Image.composite(im, rolled, mask)


def texture(name, sat, bright, shift):
    im = Image.open(SRC / f'{name}.png').convert('RGB').resize((512, 512), Image.LANCZOS)
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Brightness(im).enhance(bright)
    r, g, b = im.split()
    r, g, b = (c.point(lambda v, d=d: max(0, min(255, v + d))) for c, d in zip((r, g, b), shift))
    im = Image.merge('RGB', (r, g, b))
    # büyük açık-koyu lekeleri düzleştir (tekrar eden desen göze batmasın); ince ayrıntı kalır
    from PIL import ImageFilter
    blur = im.filter(ImageFilter.GaussianBlur(40))
    mean = tuple(int(sum(c) / len(c)) for c in zip(*[im.resize((1, 1), Image.BOX).getpixel((0, 0))]))
    im = ImageChops.add(ImageChops.subtract(im, blur, 1, 128), Image.new('RGB', im.size, mean), 1, -128)
    im = seamless(im)
    im.save(OUT / f'{name}.jpg', quality=86)
    print('doku', name)


def sprite(name, tol):
    p = SRC / f'{name}.png'
    if not p.exists():
        print('yok', name)
        return
    im = remove_background(Image.open(p), tol)
    # gri yumuşak gölge kalıntısını sil: düşük doygunluklu, açık pikseller
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a or name == 'kaya':
                continue
            if name.endswith('-kar') or name == 'mese-kis':
                # karlı ağaç: yalnız dipteki gölgeyi sil (gövdeye dokunma); çıplak meşede dallar arası beyaz boşluk
                sat, hi = max(r, g, b) - min(r, g, b), max(r, g, b)
                if (y > h * 0.86 and not (r > g + 12)) or (name == 'mese-kis' and min(r, g, b) > 228):
                    px[x, y] = (r, g, b, 0)
                continue
            sat, hi = max(r, g, b) - min(r, g, b), max(r, g, b)
            base = name.split('-')[0] in ('mese', 'kuknar', 'kavak', 'yaprakli', 'camlar') and not name.endswith('-kar') and name != 'mese-kis' and y > h * 0.84 and not (r > g + 12 and hi < 200)
            halo = y > h * 0.66 and hi > 165 and sat < 60
            if base or halo or (sat < 18 and hi > 150) or (y > h * 0.8 and (sat < 32 or hi > 185)):
                px[x, y] = (r, g, b, 0)
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox())
    width = 256
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.png', optimize=True)
    print('görsel', name, im.size)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for n, a in TEXTURES.items():
        texture(n, *a)
    for n, t in SPRITES.items():
        sprite(n, t)
