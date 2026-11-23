// İzometrik şehir çizimi (Canvas 2D). Oyun mantığını değiştirmez, yalnız okur.
import { CONFIG, BUILDINGS, TENANTS } from './data.js';
import * as G from './game.js';

export const TW = 64; // kare genişliği
export const TH = 32; // kare yüksekliği

const CAT_COLORS = {
  simge: { top: '#c9a227', left: '#f4ead0', right: '#dccfa8' },
  konut: { top: '#f29e4c', left: '#f6e7cf', right: '#e2cba8' },
  ticari: { top: '#3d8bd9', left: '#d9ecfb', right: '#b7d4ee' },
  kamu: { top: '#6fbf4a', left: '#e2f1d6', right: '#c8e0b5' },
  sanayi: { top: '#7b7a8e', left: '#d4d3dd', right: '#b5b4c4' },
};

const GROUND = {
  grassA: '#9fd16a', grassB: '#96ca61',
  locked: '#6f8f5c', lockedB: '#6a8857',
  avenue: '#5d6470', road: '#868d99', roadOff: '#b07a74',
  line: '#f4f1e4',
};

// Bina görselleri: img/binalar/<tür>.png varsa kutu yerine o çizilir, yoksa kutu kalır.
// Kurallar için img/binalar/OKU.md dosyasına bak.
export const SPRITE_DIR = 'img/binalar/';
const sprites = {};

export function loadSprites(onLoad = () => {}) {
  for (const type of Object.keys(BUILDINGS)) {
    if (type === 'yol') continue;
    const img = new Image();
    img.onload = () => { sprites[type] = img; onLoad(type); };
    img.onerror = () => {};
    img.src = `${SPRITE_DIR}${BUILDINGS[type].sprite || type}.png`;
  }
}

export function hasSprite(type) {
  return !!sprites[type];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0, z: 1 };
  let dpr = 1, W = 0, H = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  // Karenin üst köşesinin ekran konumu
  function toScreen(x, y) {
    return [cam.x + (x - y) * (TW / 2) * cam.z, cam.y + (x + y) * (TH / 2) * cam.z];
  }

  function screenToTile(sx, sy) {
    const ix = (sx - cam.x) / cam.z;
    const iy = (sy - cam.y) / cam.z;
    const fx = (ix / (TW / 2) + iy / (TH / 2)) / 2;
    const fy = (iy / (TH / 2) - ix / (TW / 2)) / 2;
    return [Math.floor(fx), Math.floor(fy)];
  }

  function centerOn(tx, ty, z) {
    if (z) cam.z = z;
    const ix = (tx - ty) * (TW / 2) * cam.z;
    const iy = (tx + ty) * (TH / 2) * cam.z;
    cam.x = W / 2 - ix;
    cam.y = H * 0.45 - iy;
  }

  function zoomAt(sx, sy, factor) {
    const nz = G.clamp(cam.z * factor, 0.45, 2.6);
    const f = nz / cam.z;
    cam.x = sx - (sx - cam.x) * f;
    cam.y = sy - (sy - cam.y) * f;
    cam.z = nz;
  }

  function pan(dx, dy) {
    cam.x += dx;
    cam.y += dy;
    // haritayı ekrandan tamamen kaçırmayı önle
    const n = CONFIG.gridSize;
    const [cx, cy] = toScreen(n / 2, n / 2);
    const lim = n * TW * cam.z * 0.5;
    if (cx < W / 2 - lim) cam.x += W / 2 - lim - cx;
    if (cx > W / 2 + lim) cam.x -= cx - (W / 2 + lim);
    if (cy < H / 2 - lim * 0.6) cam.y += H / 2 - lim * 0.6 - cy;
    if (cy > H / 2 + lim * 0.6) cam.y -= cy - (H / 2 + lim * 0.6);
  }

  // Bir karenin (ya da n×n alanın) baklavası
  function diamond(x, y, inset = 0, n = 1) {
    const [sx, sy] = toScreen(x, y);
    const hw = (TW / 2) * cam.z * n * (1 - inset);
    const hh = (TH / 2) * cam.z * n * (1 - inset);
    const cx = sx, cy = sy + (TH / 2) * cam.z * n;
    return { cx, cy, pts: [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]] };
  }


  function poly(pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawGround(s, view) {
    const n = CONFIG.gridSize;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = diamond(x, y);
        const unlocked = G.isUnlocked(s, x, y);
        const alt = (x + y) % 2 === 0;
        let fill = unlocked ? (alt ? GROUND.grassA : GROUND.grassB) : (alt ? GROUND.locked : GROUND.lockedB);
        const b = G.buildingAt(s, x, y);
        if (G.isAvenue(x, y)) fill = GROUND.avenue;
        else if (b && b.type === 'yol') fill = G.isRoadConnected(s, x, y) ? GROUND.road : GROUND.roadOff;
        poly(d.pts, fill);
        if (G.isAvenue(x, y)) {
          ctx.strokeStyle = GROUND.line;
          ctx.lineWidth = 1.5 * cam.z;
          ctx.setLineDash([4 * cam.z, 4 * cam.z]);
          ctx.beginPath();
          ctx.moveTo((d.pts[0][0] + d.pts[3][0]) / 2, (d.pts[0][1] + d.pts[3][1]) / 2);
          ctx.lineTo((d.pts[1][0] + d.pts[2][0]) / 2, (d.pts[1][1] + d.pts[2][1]) / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (unlocked) {
          ctx.lineWidth = 1;
          poly(d.pts, null, 'rgba(40,70,30,0.12)');
        }
      }
    }
  }

  function drawInfluence(s, src) {
    const e = BUILDINGS[src.type].effect;
    if (!e) return;
    const positive = e.all > 0 || (e.all === 0 && Object.values(e.tenants || {}).some(v => v > 0));
    const color = e.all < 0 ? 'rgba(225,72,72,0.30)' : positive ? 'rgba(255,236,120,0.42)' : 'rgba(255,255,255,0.3)';
    const n = G.sizeOf(src.type);
    const x0 = src.x - e.radius, y0 = src.y - e.radius;
    const x1 = src.x + n - 1 + e.radius, y1 = src.y + n - 1 + e.radius;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!G.inBounds(x, y)) continue;
        poly(diamond(x, y, 0.06).pts, color);
      }
    }
    // dış çerçeve
    const a = diamond(x0, y0).pts[0];
    const b = diamond(x1, y0).pts[1];
    const c = diamond(x1, y1).pts[2];
    const d = diamond(x0, y1).pts[3];
    ctx.lineWidth = 2 * cam.z;
    ctx.setLineDash([6 * cam.z, 4 * cam.z]);
    poly([a, b, c, d], null, e.all < 0 ? '#c43d3d' : '#fff6c2');
    ctx.setLineDash([]);
  }

  function drawParcels(s, labels = false) {
    const p = CONFIG.parcelSize;
    const max = CONFIG.gridSize / p;
    const price = G.parcelCost(s);
    for (let py = 0; py < max; py++) {
      for (let px = 0; px < max; px++) {
        if (s.parcels.includes(`${px},${py}`)) continue;
        const a = diamond(px * p, py * p).pts[0];
        const b = diamond(px * p + p - 1, py * p).pts[1];
        const c = diamond(px * p + p - 1, py * p + p - 1).pts[2];
        const d = diamond(px * p, py * p + p - 1).pts[3];
        const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2;
        if (labels) { pill(cx, cy, `🔒 ${G.formatMoney(price)}`, 'rgba(22,32,48,0.78)', '#ffe08a', 11); continue; }
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        poly([a, b, c, d], 'rgba(20,40,20,0.10)', 'rgba(255,255,255,0.55)');
        ctx.setLineDash([]);
      }
    }
  }

  function pill(cx, cy, text, bg, fg, size = 11) {
    const fs = Math.max(9, size * Math.min(cam.z, 1.4));
    ctx.font = `700 ${fs}px "Nunito", system-ui, sans-serif`;
    const w = ctx.measureText(text).width + fs * 1.1;
    const h = fs * 1.7;
    ctx.fillStyle = bg;
    roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 0.5);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Binanın karenin üst köşesinden ne kadar yükseğe çıktığı (balon ve etiketler için)
  function buildingTop(type) {
    const img = sprites[type];
    const n = G.sizeOf(type);
    if (img) return TW * cam.z * n * (BUILDINGS[type].spriteScale || 1) * img.naturalHeight / img.naturalWidth - TH * cam.z * n;
    return (BUILDINGS[type].height || 0) * cam.z;
  }

  function drawSprite(b, img, alpha, selected, tint) {
    const d = BUILDINGS[b.type];
    const n = G.sizeOf(b.type);
    const [sx, sy] = toScreen(b.x, b.y);
    const w = TW * cam.z * n * (d.spriteScale || 1);
    const h = w * img.naturalHeight / img.naturalWidth;
    const bottom = sy + TH * cam.z * n; // alanın alt köşesi = görselin alt kenarı
    ctx.globalAlpha = alpha;
    if (tint) poly(diamond(b.x, b.y, 0.04, n).pts, 'rgba(229,83,75,0.55)');
    if (selected) {
      ctx.lineWidth = 2.5;
      poly(diamond(b.x, b.y, 0.04, n).pts, 'rgba(255,255,255,0.25)', '#ffffff');
    }
    ctx.drawImage(img, sx - w / 2, bottom - h, w, h);
    ctx.globalAlpha = 1;
  }

  function drawBuilding(b, alpha = 1, selected = false, tint = null) {
    const d = BUILDINGS[b.type];
    if (sprites[b.type]) return drawSprite(b, sprites[b.type], alpha, selected, tint);
    const col = CAT_COLORS[d.cat];
    const h = (d.height || 0) * cam.z;
    const n = G.sizeOf(b.type);
    const inset = d.cat === 'kamu' && !d.height ? 0.08 : 0.2 / n;
    const g = diamond(b.x, b.y, inset, n).pts;
    const t = g.map(([x, y]) => [x, y - h]);
    ctx.globalAlpha = alpha;
    // gölge
    poly(diamond(b.x, b.y, inset * 0.6, n).pts, 'rgba(30,50,20,0.18)');
    if (h > 0) {
      poly([g[3], g[2], t[2], t[3]], col.left);
      poly([g[2], g[1], t[1], t[2]], col.right);
      // pencereler
      if (d.cat !== 'kamu' || d.height > 12) drawWindows(g, t, h, d.cat);
    }
    poly(t, tint || col.top);
    if (d.smoke) drawChimney(b, d, h);
    ctx.lineWidth = selected ? 2.5 : 1;
    poly(t, null, selected ? '#ffffff' : 'rgba(0,0,0,0.15)');
    if (selected && h > 0) {
      poly([g[3], g[2], g[1], t[1], t[0], t[3]], null, '#ffffff');
    }
    // simge
    const cx = t[0][0], cy = (t[0][1] + t[2][1]) / 2;
    const fs = (d.height ? 18 : 22) * cam.z;
    ctx.font = `${fs}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.icon, cx, cy);
    ctx.globalAlpha = 1;
  }

  // Kutu çiziminde bacalı binalara küçük bir baca
  function drawChimney(b, d, h) {
    const n = G.sizeOf(b.type);
    const sm = Array.isArray(d.smoke) ? d.smoke[0] : d.smoke;
    const fx = b.x + n / 2 + sm.x, fy = b.y + n / 2 + sm.y;
    const [cx, cy] = toScreen(fx, fy);
    const w = 4 * cam.z, top = cy - (sm.h ?? (d.height || 0) + 14) * cam.z;
    ctx.fillStyle = '#8b4a3a';
    ctx.fillRect(cx - w, top, w * 2, cy - h - top);
    ctx.fillStyle = '#5c2f25';
    ctx.fillRect(cx - w - 1, top - 2 * cam.z, w * 2 + 2, 3 * cam.z);
  }


  function drawWindows(g, t, h, cat) {
    const rows = Math.max(1, Math.floor(h / (10 * cam.z)));
    ctx.fillStyle = cat === 'sanayi' ? 'rgba(60,60,80,0.35)' : 'rgba(70,110,150,0.45)';
    for (let face = 0; face < 2; face++) {
      const [a, b] = face === 0 ? [g[3], g[2]] : [g[2], g[1]];
      for (let r = 0; r < rows; r++) {
        const fy = (r + 0.35) / rows;
        for (const fx of [0.3, 0.7]) {
          const x = a[0] + (b[0] - a[0]) * fx;
          const y = a[1] + (b[1] - a[1]) * fx - h * (1 - fy);
          ctx.fillRect(x - 2 * cam.z, y - 2.5 * cam.z, 4 * cam.z, 4 * cam.z);
        }
      }
    }
  }

  function bubble(cx, cy, icon, ring = null, ringColor = '#3ddc97', bg = '#ffffff') {
    const r = 11 * Math.max(0.8, cam.z);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (ring !== null) {
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.font = `${r * 1.1}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy + 1);
  }

  function satColor(v) {
    if (v >= CONFIG.satHappy) return '#2fbf71';
    if (v >= 40) return '#f2b134';
    return '#e5534b';
  }

  function drawStatus(s, b, t) {
    const d = BUILDINGS[b.type];
    const [sx, sy] = toScreen(b.x, b.y);
    const top = sy - buildingTop(b.type) - 4 * cam.z;
    const pulse = 1 + Math.sin(t / 220) * 0.06;
    if (G.isHouse(b)) {
      const st = G.houseStatus(s, b);
      if (st === 'baglantisiz') bubble(sx, top, '⚠️', null, null, '#fff3cd');
      else if (st === 'hazir') {
        ctx.save(); ctx.translate(sx, top); ctx.scale(pulse, pulse);
        bubble(0, 0, '💰', null, null, '#fff6d6');
        ctx.restore();
      } else if (st === 'kirada') {
        const c = b.contract;
        const p = (s.gameTime - c.start) / (c.end - c.start);
        bubble(sx, top, TENANTS[c.tenant].icon, p, satColor(G.satisfaction(s, b)));
      } else if (st === 'yenileme') bubble(sx, top, '🔁', null, null, '#e6f6ff');
      else bubble(sx, top, '🔑', null, null, '#ffffff');
    } else if (G.hasIncome(b)) {
      if (!G.isConnected(s, b)) bubble(sx, top, '⚠️', null, null, '#fff3cd');
      else if (G.isCollectable(s, b)) {
        ctx.save(); ctx.translate(sx, top); ctx.scale(pulse, pulse);
        bubble(0, 0, '🪙', (b.stored || 0) / G.storageCap(b.type), '#f2b134', '#fff6d6');
        ctx.restore();
      }
    }
  }

  function draw(s, view, t, amb = null) {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#7cc6de');
    sky.addColorStop(1, '#c4e8d8');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    drawGround(s, view);
    drawParcels(s);

    const pl = view.placement;
    const sel = view.selectedId ? s.buildings[view.selectedId] : null;
    if (pl && pl.type !== 'yol') drawInfluence(s, pl);
    else if (sel) drawInfluence(s, sel);

    // binalar, ağaçlar, arabalar, insanlar: arkadan öne (karenin merkezine göre)
    const list = Object.values(s.buildings).filter(b => b.type !== 'yol' && (!pl || b.id !== pl.moveId));
    const keyOf = b => { const n = G.sizeOf(b.type); return { key: b.x + b.y + n, kx: b.x + n / 2 }; };
    const items = list.map(b => ({ b, ghost: false, ...keyOf(b) }));
    if (pl && pl.type !== 'yol') {
      const g = { id: '_ghost', type: pl.type, x: pl.x, y: pl.y };
      items.push({ b: g, ghost: true, ...keyOf(g) });
    }
    const all = amb ? items.concat(amb.drawables(s, t)) : items;
    all.sort((a, b) => a.key - b.key || a.kx - b.kx);
    for (const it of all) {
      if (it.draw) it.draw();
      else if (it.ghost) drawBuilding(it.b, 0.82, true, pl.valid ? null : '#e5534b');
      else drawBuilding(it.b, 1, sel && sel.id === it.b.id);
    }

    if (amb) amb.drawOverlay(t);
    drawParcels(s, true); // fiyat etiketleri ağaçların üstünde kalsın

    if (!pl) for (const it of items) drawStatus(s, it.b, t);

    if (pl && pl.type !== 'yol') drawPlacementPreview(s, pl);

    // yükselen yazılar
    for (const f of view.floaters) {
      const k = (t - f.t0) / 1100;
      if (k > 1) continue;
      const [sx, sy] = toScreen(f.x, f.y);
      c.globalAlpha = 1 - k * k;
      pill(sx, sy - 30 * cam.z - k * 34, f.text, 'rgba(22,32,48,0.85)', f.color || '#ffe08a', 12);
      c.globalAlpha = 1;
    }
  }

  // Yerleştirirken etkilenen evlerde bonus değişimini göster
  function drawPlacementPreview(s, pl) {
    const d = BUILDINGS[pl.type];
    const extra = { id: '_ghost', type: pl.type, x: pl.x, y: pl.y };
    if (d.effect) {
      for (const h of Object.values(s.buildings)) {
        if (!G.isHouse(h) || h.id === pl.moveId) continue;
        const tenant = h.contract ? h.contract.tenant : null;
        const before = G.bonusAt(s, h.x, h.y, tenant, { ignoreId: pl.moveId }).total;
        const after = G.bonusAt(s, h.x, h.y, tenant, { extra, ignoreId: pl.moveId }).total;
        const delta = after - (pl.moveId ? G.bonusAt(s, h.x, h.y, tenant).total : before);
        if (delta === 0) continue;
        const [sx, sy] = toScreen(h.x, h.y);
        const top = sy - buildingTop(h.type) - 6 * cam.z;
        pill(sx, top, `${delta > 0 ? '+' : ''}%${delta}`, delta > 0 ? '#1f8f55' : '#c43d3d', '#ffffff', 12);
      }
    }
    if (d.cat === 'konut') {
      const v = G.bonusAt(s, pl.x, pl.y, null, { ignoreId: pl.moveId }).total;
      const [sx, sy] = toScreen(pl.x, pl.y);
      const top = sy - buildingTop(pl.type) - 8 * cam.z;
      pill(sx, top, `konum ${v >= 0 ? '+' : ''}%${v}`, v > 0 ? '#1f8f55' : v < 0 ? '#c43d3d' : 'rgba(22,32,48,0.8)', '#fff', 12);
    }
  }

  return {
    cam, ctx, resize, draw, screenToTile, centerOn, zoomAt, pan, toScreen, poly, buildingTop,
    get size() { return { W, H }; },
  };
}
