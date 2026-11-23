"""Uygulama ikonundan Android ikonlarını ve açılış ekranını üretir.

Kullanım: python3 tools/android_ikon.py
Kaynak: img/ui/uygulama-ikonu.png (1024x1024)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
SKY = (124, 198, 222, 255)

src = Image.open(ROOT / 'img' / 'ui' / 'uygulama-ikonu.png').convert('RGBA')
w, h = src.size
# ikonun yuvarlak köşelerini at: kenardan %7 içeriden kırp
m = int(w * 0.07)
full = src.crop((m, m, w - m, h - m))

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in dens.items():
    d = RES / f'mipmap-{name}'
    size = round(48 * k)
    sq = full.resize((size, size), Image.LANCZOS)
    # kare ikon: hafif yuvarlak köşe
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); out.paste(sq, (0, 0), mask)
    out.save(d / 'ic_launcher.png')
    # yuvarlak ikon
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); out.paste(sq, (0, 0), mask)
    out.save(d / 'ic_launcher_round.png')
    # uyarlanabilir ikon ön yüzü (108dp, sistem maskeler): resim tam kaplar
    fg = round(108 * k)
    full.resize((fg, fg), Image.LANCZOS).save(d / 'ic_launcher_foreground.png')

# açılış ekranı: gökyüzü rengi, ortada ikon
for p in RES.glob('drawable*/splash.png'):
    w, h = Image.open(p).size
    canvas = Image.new('RGBA', (w, h), SKY)
    s = int(min(w, h) * 0.38)
    ic = full.resize((s, s), Image.LANCZOS)
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 5, fill=255)
    canvas.paste(ic, ((w - s) // 2, (h - s) // 2), mask)
    canvas.convert('RGB').save(p)
print('Android ikonları ve açılış ekranı üretildi')
