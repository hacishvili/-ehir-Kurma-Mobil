"""Yol parçalarını tek bir düz yol görselinden üretir.

Kullanım:
    python3 tools/yol_hazirla.py            # img/kaynak/yollar/<tür>-duz.png olan her tür
    python3 tools/yol_hazirla.py yol-tas    # yalnız bir tür

Girdi: img/kaynak/yollar/<tür>-duz.png. Tam üstten çekilmiş, yukarıdan aşağı inen düz yol,
yol dışı pembe (#FF00FF).
Çıktı: img/yollar/<tür>-<n>.png, n = 0..15. n komşu bağlantılarının toplamıdır:
kuzey (üst kenar) 1, doğu (sağ) 2, güney (alt) 4, batı (sol) 8. Görseller 256 piksel, şeffaf.

Neden tek görselden: yapay zekâ her parçayı ayrı çizince yol genişliği ve kenar taşı parçadan
parçaya değişiyor, yan yana gelince yollar oturmuyor. Burada dönemeç, T, dört yol ve çıkmaz
aynı düz yolun dokusundan hesaplanır; her kenarda yol aynı genişlikte ve aynı yerde biter.

Gerekenler: Python 3, Pillow ve numpy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'img' / 'kaynak' / 'yollar'
OUT = ROOT / 'img' / 'yollar'
N = 256
BAND = 0.6  # yol bandı (kenar taşları dahil) karenin bu kadarı; ana caddenin yanında patika gibi kalmasın
NORTH, EAST, SOUTH, WEST = 1, 2, 4, 8


def background(a):
    """Yol dışı: pembe (#FF00FF ve tonları) ya da beyaz/krem zemin."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (r > 140) & (b > 90) & (g < 0.6 * r) & (g < 0.75 * b)
    white = a.min(-1) > 236
    return magenta | white


def load_straight(path):
    """Düz yolu N×N'e küçültür; yolun sol ve sağ kenarını (sütun) bulur.
    Görselin üstünde/altında boşluk varsa (yol kenara değmiyorsa) yalnız yolun olduğu satırlar alınır."""
    full = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    h, w = full.shape[:2]
    bg = background(full)
    cols = np.where((~bg[h // 4: 3 * h // 4]).mean(0) > 0.9)[0]
    rows = np.where((~bg[:, cols.min():cols.max() + 1]).mean(1) > 0.97)[0]
    full = full[rows.min():rows.max() + 1]
    im = Image.fromarray(full.astype(np.uint8)).resize((N, N), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    road_cols = np.where((~background(a)[N // 4: 3 * N // 4]).mean(0) > 0.9)[0]
    left, right = int(road_cols.min()), int(road_cols.max())
    a = make_tileable(a)
    return a, left, right


def make_tileable(a):
    """Alt ve üst kenar dikişsiz birleşsin: ilk k satır kesilip son k satırla karıştırılır.
    Sonuçta son satırın devamı ilk satır olur; görsel yeniden N satıra esnetilir."""
    k = N // 6
    w = np.linspace(0, 1, k)[:, None, None]
    out = a[k:].copy()
    out[-k:] = a[N - k:] * (1 - w) + a[:k] * w
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((N, N), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def widen(a, left, right):
    """Bandı karenin ortasına alıp BAND genişliğine getirir. Kenar taşları aynen kalır,
    aradaki yol yüzeyi aynalanarak uzatılır (taşlar basık görünmesin diye esnetilmez)."""
    curb = estimate_curb(a, left, right)
    width = int(round(N * BAND))
    L = (N - width) // 2
    R = L + width - 1
    out = np.zeros_like(a)
    cols = np.arange(N)
    src = np.full(N, -1)
    src[L:L + curb] = left + np.arange(curb)
    src[R - curb + 1:R + 1] = right - curb + 1 + np.arange(curb)
    inner = np.arange(L + curb, R - curb + 1)
    lo, hi = left + curb, right - curb
    centre = (lo + hi) / 2 - (L + R) / 2
    src[L + curb:R - curb + 1] = mirror(inner + centre, lo, hi).round().astype(int)
    out[:, cols[src >= 0]] = a[:, src[src >= 0]]
    return out, L, R


def mirror(i, lo, hi):
    """i'yi [lo, hi] aralığına aynalayarak katlar (dokuyu dikişsiz uzatır)."""
    span = hi - lo
    t = np.mod(i - lo, 2 * span)
    return np.where(t <= span, lo + t, lo + 2 * span - t)


def sample(a, rows, cols):
    rows = np.mod(np.round(rows).astype(int), N)
    cols = np.clip(np.round(cols).astype(int), 0, N - 1)
    return a[rows, cols]


def region(mask, left, right, pad):
    """Yolun kapladığı alan; kenarlardan dışarı pad kadar uzatılmış (kenarda kenar taşı çıkmasın)."""
    M = N + 2 * pad
    y, x = np.mgrid[0:M, 0:M].astype(np.float32) - pad + 0.5
    lo, hi = left, right + 1
    inside_v = (x >= lo) & (x < hi)
    inside_h = (y >= lo) & (y < hi)
    mid = N / 2
    count = bin(mask).count('1')
    if count <= 1:
        rr = (hi - lo) / 2
        center = (x - mid) ** 2 + (y - mid) ** 2 <= rr * rr
    else:
        center = inside_v & inside_h
    R = center.copy()
    if mask & NORTH: R |= inside_v & (y < mid)
    if mask & SOUTH: R |= inside_v & (y >= mid)
    if mask & WEST: R |= inside_h & (x < mid)
    if mask & EAST: R |= inside_h & (x >= mid)
    return R


def nearest_wall(R, pad):
    """Her yol pikseli için en yakın yol dışı pikselin uzaklığı ve yönü (kaba kuvvet, küçük boyut)."""
    M = R.shape[0]
    # sınır pikselleri: yol dışı olup bir komşusu yol olanlar
    out = ~R
    nb = np.zeros_like(R)
    nb[1:] |= R[:-1]; nb[:-1] |= R[1:]; nb[:, 1:] |= R[:, :-1]; nb[:, :-1] |= R[:, 1:]
    by, bx = np.where(out & nb)
    ys, xs = np.mgrid[pad:pad + N, pad:pad + N]
    ys = ys.ravel(); xs = xs.ravel()
    best = np.full(ys.shape, 1e9, np.float32)
    vy = np.zeros(ys.shape, np.float32); vx = np.zeros(ys.shape, np.float32)
    for i in range(0, len(by), 256):
        dy = by[None, i:i + 256] - ys[:, None]
        dx = bx[None, i:i + 256] - xs[:, None]
        d = dx * dx + dy * dy
        j = d.argmin(1)
        dm = d[np.arange(len(ys)), j]
        upd = dm < best
        best[upd] = dm[upd]
        vy[upd] = dy[np.arange(len(ys)), j][upd]
        vx[upd] = dx[np.arange(len(ys)), j][upd]
    return np.sqrt(best).reshape(N, N) - 0.5, vy.reshape(N, N), vx.reshape(N, N)


def build(a, left, right, mask):
    pad = 4
    curb = estimate_curb(a, left, right)
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    rgb = np.zeros((N, N, 3), np.float32)
    alpha = np.zeros((N, N), np.float32)

    if mask in (NORTH | EAST, EAST | SOUTH, SOUTH | WEST, WEST | NORTH):
        # dönemeç: köşe merkezli halka, dokusu yay boyunca bükülür
        cx = N if mask & EAST else 0
        cy = 0 if mask & NORTH else N
        r = np.hypot(x + 0.5 - cx, y + 0.5 - cy)
        # kuzey kenarında: sol kenar (left) köşeye uzak olan taraf için cx'e göre seçilir
        # kuzeyden gelen kolda sütun = x; doğu köşesinde x = N - r, batı köşesinde x = r
        col = N - r if cx == N else r
        theta = np.arctan2(np.abs(y + 0.5 - cy), np.abs(x + 0.5 - cx))  # 0: yatay kol, π/2: dikey kol
        along = theta / (np.pi / 2) * N
        if cy == N:
            along = N - along
        rgb = sample(a, along, col)
        lo_r = N - right - 1 if cx == N else left
        hi_r = N - left if cx == N else right + 1
        alpha = np.clip(np.minimum(r - lo_r, hi_r - r) + 0.5, 0, 1)
        return rgb, alpha

    R = region(mask, left, right, pad)
    dist, vy, vx = nearest_wall(R, pad)
    inside = R[pad:pad + N, pad:pad + N]
    horizontal_wall = np.abs(vy) > np.abs(vx)  # duvar üstte/altta: yatay yol
    # kenar taşı: duvara uzaklığa göre düz yolun kenar kesitinden al
    d = np.clip(dist, 0, None)
    col_v = np.where(vx > 0, right - d, left + d)
    col_h = np.where(vy > 0, right - d, left + d)
    curb_px = np.where(horizontal_wall[..., None], sample(a, x, col_h), sample(a, y, col_v))
    # iç doku: dikey yolda S[y, x], yatay yolda S[x, y]; kenar taşının içinde kalan sütunlar aynalanır
    lo_i, hi_i = left + curb, right - curb
    vertical_zone = ((mask & (NORTH | SOUTH)) != 0)
    in_center = (x >= left) & (x <= right) & (y >= left) & (y <= right)
    in_v_arm = (x >= left) & (x <= right) & ~in_center
    use_v = np.where(in_center, vertical_zone, in_v_arm)
    fill_v = sample(a, y, mirror(x, lo_i, hi_i))
    fill_h = sample(a, x, mirror(y, lo_i, hi_i))
    fill = np.where(use_v[..., None], fill_v, fill_h)
    # tam düz yolda doku hiç değişmesin
    if mask == (NORTH | SOUTH):
        fill = sample(a, y, x)
        curb_px = fill
    elif mask == (EAST | WEST):
        fill = sample(a, x, y)
        curb_px = fill
    t = np.clip((d - curb) / 2 + 0.5, 0, 1)[..., None]
    rgb = curb_px * (1 - t) + fill * t
    alpha = np.where(inside, np.clip(dist + 1, 0, 1), 0)
    return rgb, alpha


def estimate_curb(a, left, right):
    """Kenar taşı genişliği: kenardan içeri, renk yolun ortasındakine yaklaşana kadar."""
    prof = a[N // 4: 3 * N // 4].mean(0)
    bw = right - left
    mid = np.median(prof[left + int(bw * 0.3): right - int(bw * 0.3)], axis=0)  # orta çizgiye takılmasın
    c = 0
    for i in range(left, (left + right) // 2):
        if np.abs(prof[i] - mid).mean() < 22:
            c = max(c, 0)
        else:
            c = i - left + 1
        if i - left > (right - left) * 0.3:
            break
    return max(3, min(c, int((right - left) * 0.3)))


# Köprü görselleri: (kaynak, köprü yolunun yüzeyi kaynakta hangi sütunlar arasında, 1024 genişlikte).
# Köprü, yüzeyi karadaki parçanın yüzeyiyle aynı genişlikte olacak şekilde ölçeklenir; korkuluklar
# bandın dışına, suyun üstüne taşar.
BRIDGES = {
    'cadde': ('cadde-kopru.png', (360, 660)),
    'yol': ('yol-kopru.png', (380, 650)),
    'yol-tas': ('yol-tas-kopru.png', (410, 620)),
}


def make_bridge(kind, land, left, right):
    name, (s0, s1) = BRIDGES[kind]
    path = SRC / name
    if not path.exists():
        return False
    full = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    h, w = full.shape[:2]
    bg = background(full)
    cols = np.where((~bg[h // 4: 3 * h // 4]).mean(0) > 0.5)[0]
    rows = np.where((~bg[:, (s0 + s1) // 2 * w // 1024]))[0]
    full = full[rows.min():rows.max() + 1]
    curb = estimate_curb(land, left, right)
    target = (right - curb) - (left + curb) + 1  # karadaki yol yüzeyi (piksel)
    scale = target / ((s1 - s0) * w / 1024)
    nw = int(round(w * scale))
    im = Image.fromarray(full.astype(np.uint8)).resize((nw, N), Image.LANCZOS)
    a = make_tileable(np.asarray(im).astype(np.float32)) if nw == N else np.asarray(im).astype(np.float32)
    # yüzeyin ortası karenin ortasına gelsin
    centre = (s0 + s1) / 2 * w / 1024 * scale
    off = int(round(N / 2 - centre))
    out = np.zeros((N, N, 4), np.float32)
    for x in range(N):
        sx = x - off
        if 0 <= sx < nw:
            out[:, x, :3] = a[:, sx]
    keep = ~background(out[..., :3])
    lo, hi = cols.min() * scale + off, cols.max() * scale + off
    xs = np.arange(N)[None, :]
    out[..., 3] = np.where(keep & (xs >= lo) & (xs <= hi), 255, 0)
    Image.fromarray(out.astype(np.uint8), 'RGBA').save(OUT / f'{kind}-kopru.png', optimize=True)
    return True


def main():
    kinds = sys.argv[1:] or [p.stem[:-4] for p in sorted(SRC.glob('*-duz.png'))]
    OUT.mkdir(parents=True, exist_ok=True)
    for kind in kinds:
        a, left, right = load_straight(SRC / f'{kind}-duz.png')
        a, left, right = widen(a, left, right)
        for mask in range(16):
            rgb, alpha = build(a, left, right, mask)
            out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
            Image.fromarray(out, 'RGBA').save(OUT / f'{kind}-{mask}.png', optimize=True)
        bridge = make_bridge(kind, a, left, right) if kind in BRIDGES else False
        print(f'{kind}: yol {left}-{right} / {N}, kenar taşı {estimate_curb(a, left, right)} px, 16 parça' + (', köprü' if bridge else ''))


if __name__ == '__main__':
    main()
