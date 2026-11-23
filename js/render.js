// İzometrik şehir çizimi (Canvas 2D). Oyun mantığını değiştirmez, yalnız okur.
import { CONFIG, BUILDINGS, TENANTS, TERRAIN, UPGRADES, VARIANTS, RESOURCES, VISITORS, HOODS, AVENUES } from './data.js';
import * as G from './game.js';

export const TW = 64; // kare genişliği
export const TH = 32; // kare yüksekliği

const CAT_COLORS = {
  simge: { top: '#c9a227', left: '#f4ead0', right: '#dccfa8' },
  hammadde: { top: '#a8814f', left: '#efe2cc', right: '#d8c6a6' },
  isleme: { top: '#8c6f5c', left: '#e6dbd2', right: '#cbbdb1' },
  dekor: { top: '#8fcf6a', left: '#e6f2dc', right: '#cfe3c0' },
  konut: { top: '#f29e4c', left: '#f6e7cf', right: '#e2cba8' },
  ticari: { top: '#3d8bd9', left: '#d9ecfb', right: '#b7d4ee' },
  kamu: { top: '#6fbf4a', left: '#e2f1d6', right: '#c8e0b5' },
  sanayi: { top: '#7b7a8e', left: '#d4d3dd', right: '#b5b4c4' },
};

const GROUND = {
  grassA: '#9fd16a', grassB: '#96ca61',
  locked: '#6f8f5c', lockedB: '#6a8857',
  avenue: '#5d6470', road: '#868d99', roadOff: '#b07a74', cobble: '#a8988a',
  line: '#f4f1e4',
};

// Harita çevresindeki doğa: img/doga/. w = kare genişliğine göre görsel genişliği,
// sway = rüzgârda sallanma payı, weight = ormanda görülme sıklığı
export const NATURE = {
  kuknar: { w: 0.62, sway: 0.5, weight: 26 },
  yaprakli: { w: 0.74, sway: 1, weight: 20 },
  mese: { w: 1.05, sway: 0.8, weight: 14 },
  camlar: { w: 0.86, sway: 0.5, weight: 12 },
  kavak: { w: 0.24, sway: 1.3, weight: 8 },
  cali: { w: 0.58, sway: 0, weight: 11 },
  kaya: { w: 0.5, sway: 0, weight: 5 },
  cicekler: { w: 0.48, sway: 0, weight: 6 },
};
// Ağaçlar evlerle orantılı kalsın: tek katlı ev bir karenin tamamını kaplar, ağaç onun yarısı kadar
const TREE_SCALE = 0.5;
const ROAD_IMAGE_TYPES = ['yol', 'yol-tas', 'bulvar']; // görseli olan yol türleri (img/yollar)
const NATURE_TOTAL = Object.values(NATURE).reduce((a, n) => a + n.weight, 0);
// Mevsime göre ağaç görünümü: tür → img/doga/<görsel>. null: o mevsimde çizilmez
const SEASON_TREES = {
  kis: { kuknar: 'kuknar-kar', camlar: 'camlar-kar', yaprakli: 'mese-kis', mese: 'mese-kis', kavak: 'kuknar-kar', cicekler: null },
  sonbahar: { yaprakli: 'yaprakli-sonbahar', mese: 'mese-sonbahar', kavak: 'kavak-sonbahar' },
};
// Mevsime göre zemin: [açık arsa çimi, harita dışı çayır]
const SEASON_GROUND = { kis: ['kar', 'kar'], sonbahar: ['cim', 'sonbahar'], ilkbahar: ['cim', 'yabani'], yaz: ['cim', 'yabani'] };
const WATER_EDGE = new Set(['deniz', 'kiyi', 'nehir', 'kum']); // harita dışına da uzanan zeminler
const RING = 12; // harita dışında ağaç dikilen kuşak (kare)

// Aynı karede hep aynı sonucu veren karıştırıcı (ağaçların yeri için)
function hash(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Bina görselleri: img/binalar/<tür>.png varsa kutu yerine o çizilir, yoksa kutu kalır.
// Kurallar için img/binalar/OKU.md dosyasına bak.
export const SPRITE_DIR = 'img/binalar/';
const sprites = {};

export function loadSprites(onLoad = () => {}) {
  const names = new Set();
  for (const type of Object.keys(BUILDINGS)) if (BUILDINGS[type].cat !== 'yol') names.add(type);
  // yükseltme seviyeleri ve farklı görünümler
  for (const [type, ups] of Object.entries(UPGRADES)) ups.forEach((_, i) => names.add(`${type}-${i + 2}`));
  for (const list of Object.values(VARIANTS)) list.forEach(n => names.add(n));
  for (const name of names) {
    const img = new Image();
    img.onload = () => { sprites[name] = img; onLoad(name); };
    img.onerror = () => {};
    img.src = `${SPRITE_DIR}${name}.png`;
  }
  // kiracı portreleri (haritadaki balonlar için)
  for (const id of Object.keys(TENANTS)) {
    const img = new Image();
    img.onload = () => { sprites[`kiraci-${id}`] = img; };
    img.onerror = () => {};
    img.src = `img/ui/kiraci-${id}.png`;
  }
  // zemin kareleri (nehir, tepe ...)
  for (const ter of Object.values(TERRAIN)) {
    const img = new Image();
    img.onload = () => { sprites[ter.sprite] = img; onLoad(ter.sprite); };
    img.onerror = () => {};
    img.src = `${SPRITE_DIR}${ter.sprite}.png`;
  }
  // doğa: zemin dokuları ve ağaçlar
  for (const tex of ['cim', 'yabani', 'kar', 'sonbahar']) {
    const img = new Image();
    img.onload = () => { sprites[`doku-${tex}`] = img; };
    img.src = `img/doga/${tex}.jpg`;
  }
  const natureNames = new Set(Object.keys(NATURE));
  for (const m of Object.values(SEASON_TREES)) for (const v of Object.values(m)) if (v) natureNames.add(v);
  for (const v of Object.values(VISITORS)) {
    const img = new Image();
    img.onload = () => { sprites[v.portrait] = img; };
    img.src = `img/ui/${v.portrait}.png`;
  }
  for (const name of natureNames) {
    const img = new Image();
    img.onload = () => { sprites[`doga-${name}`] = img; };
    img.src = `img/doga/${name}.png`;
  }
  // yol parçaları: tür başına 16 görsel (komşu bağlantısına göre); bağlantısız yol için kırmızımsı kopya
  // ve nehri geçen düz köprü parçası (<tür>-kopru)
  for (const kind of [...ROAD_IMAGE_TYPES, 'cadde']) {
    for (const m of [...Array(16).keys(), 'kopru']) {
      const img = new Image();
      img.onload = () => { sprites[`yol-${kind}-${m}`] = img; sprites[`yol-${kind}-${m}-off`] = tinted(img); };
      img.onerror = () => {};
      img.src = `img/yollar/${kind}-${m}.png`;
    }
  }
  // 3x3 döner kavşak tek görsel
  const kavsak = new Image();
  kavsak.onload = () => { sprites['yol-kavsak'] = kavsak; sprites['yol-kavsak-off'] = tinted(kavsak); };
  kavsak.src = 'img/yollar/kavsak.png';
  sprites['doku-deniz'] = seaTexture();
  // mahalle zemini (beton)
  const beton = new Image();
  beton.onload = () => { sprites['zemin-beton'] = beton; };
  beton.src = `${SPRITE_DIR}zemin-beton.png`;
}

// Yolu bağlı olmayan kare için görselin kırmızıya çalan kopyası (oyuncu hemen fark etsin)
function tinted(img) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(200,70,60,0.45)';
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

// Deniz dokusu (kodla): turkuaz zemin üstünde açık dalga çizgileri, dikişsiz tekrar eder
function seaTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = '#3fa3a6';
  c.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 1) * S, y = hash(i, 2) * S, r = 6 + hash(i, 3) * 26;
    c.fillStyle = hash(i, 4) < 0.5 ? 'rgba(20,90,110,0.10)' : 'rgba(120,215,205,0.10)';
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      c.beginPath(); c.arc(x + ox, y + oy, r, 0, Math.PI * 2); c.fill();
    }
  }
  c.strokeStyle = 'rgba(225,250,245,0.45)';
  c.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = hash(i, 5) * S, y = hash(i, 6) * S, w = 10 + hash(i, 7) * 18;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      c.beginPath(); c.moveTo(x + ox - w / 2, y + oy); c.quadraticCurveTo(x + ox, y + oy - 4, x + ox + w / 2, y + oy); c.stroke();
    }
  }
  return cv;
}

export function hasSprite(type) {
  return !!sprites[type];
}

export function createRenderer(canvas) {
  const mainCtx = canvas.getContext('2d');
  let ctx = mainCtx; // harita dışı ara belleğe çizilirken geçici olarak değişir
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

  // Haritanın tamamının ekrana sığdığı yakınlık: daha fazla uzaklaşılmaz
  function fitZoom() {
    const n = CONFIG.gridSize;
    return G.clamp(Math.min(W / (n * TW), H / (n * TH)), 0.3, 2);
  }

  function zoomAt(sx, sy, factor) {
    const nz = G.clamp(cam.z * factor, fitZoom(), 2.6);
    const f = nz / cam.z;
    cam.x = sx - (sx - cam.x) * f;
    cam.y = sy - (sy - cam.y) * f;
    cam.z = nz;
    pan(0, 0);
  }

  function pan(dx, dy) {
    cam.x += dx;
    cam.y += dy;
    // harita ekrandan kaçmasın: ortası, haritanın taşan kısmı kadar (biraz da pay) kayabilir
    const n = CONFIG.gridSize;
    const [cx, cy] = toScreen(n / 2, n / 2);
    const lx = Math.max(0, n * TW * cam.z / 2 - W / 2) + W * 0.12;
    const ly = Math.max(0, n * TH * cam.z / 2 - H / 2) + H * 0.12;
    if (cx < W / 2 - lx) cam.x += W / 2 - lx - cx;
    if (cx > W / 2 + lx) cam.x -= cx - (W / 2 + lx);
    if (cy < H / 2 - ly) cam.y += H / 2 - ly - cy;
    if (cy > H / 2 + ly) cam.y -= cy - (H / 2 + ly);
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

  // Doku deseni: kare görsel izometrik zemine yatırılır, k kare boyunca bir kez tekrar eder
  const patterns = new Map();
  function texture(name, k) {
    const img = sprites[`doku-${name}`];
    if (!img) return null;
    const pk = ctx === mainCtx ? name : `${name}-off`;
    let p = patterns.get(pk);
    if (!p) { p = ctx.createPattern(img, 'repeat'); patterns.set(pk, p); }
    const sc = k / (img.naturalWidth || img.width);
    const a = sc * (TW / 2) * cam.z, b = sc * (TH / 2) * cam.z;
    p.setTransform(new DOMMatrix([a, b, -a, b, cam.x, cam.y]));
    return p;
  }

  // Ekranda görünen karelerin sınırı (biraz payla)
  function visibleTiles(margin = 3) {
    const pts = [screenToTile(0, 0), screenToTile(W, 0), screenToTile(0, H), screenToTile(W, H)];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs) - margin, x1: Math.max(...xs) + margin, y0: Math.min(...ys) - margin, y1: Math.max(...ys) + margin };
  }

  // Harita dışındaki kare: deniz/nehir/kum kenardan dışarı devam eder, ana cadde ufka uzanır
  function outsideTerrain(x, y) {
    const n = CONFIG.gridSize;
    const ter = G.terrainAt(G.clamp(x, 0, n - 1), G.clamp(y, 0, n - 1));
    return WATER_EDGE.has(ter) ? ter : null;
  }
  function outsideAvenue(x, y) {
    const n = CONFIG.gridSize;
    return AVENUES.some(av => x === av.x && ((y < 0 && av.y0 === 0) || (y >= n && av.y1 === n - 1)));
  }

  // Harita dışı: yabani çayır, uzanan su ve cadde
  function drawOutside() {
    const n = CONFIG.gridSize;
    const wild = texture(SEASON_GROUND[G.season()][1], 2.6) || texture('yabani', 2.6);
    ctx.fillStyle = wild || '#5d8a3c';
    ctx.fillRect(0, 0, W, H);
    // geniş açık-koyu lekeler: çayır tek düze görünmesin
    const v = visibleTiles(4);
    for (let y = Math.floor(v.y0 / 4) * 4; y <= v.y1; y += 4) {
      for (let x = Math.floor(v.x0 / 4) * 4; x <= v.x1; x += 4) {
        const h = hash(x, y, 77);
        if (h > 0.55) continue;
        const [sx, sy] = toScreen(x + 2 + hash(x, y, 78) * 2, y + 2 + hash(x, y, 79) * 2);
        const r = (40 + hash(x, y, 80) * 70) * cam.z;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, h < 0.3 ? 'rgba(255,240,150,0.14)' : 'rgba(20,50,15,0.16)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.translate(sx, sy); ctx.scale(1.6, 0.8);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    seaFill((x, y) => !G.inBounds(x, y) && outsideTerrain(x, y) === 'deniz', v);
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        if (G.inBounds(x, y)) continue;
        const ter = outsideTerrain(x, y);
        if (ter && ter !== 'deniz' && sprites[TERRAIN[ter].sprite]) drawTile(x, y, sprites[TERRAIN[ter].sprite]);
        if (outsideAvenue(x, y)) {
          const kind = avenueKind();
          const img = sprites[`yol-${kind}-5`];
          if (img) { drawSquare(x, y, img); if (kind === 'yol') avenueLine(x, y); }
          else poly(diamond(x, y).pts, GROUND.avenue);
        }
      }
    }
    // haritanın kenarında hafif gölge: şehir alanı çayırdan ayrılsın
    const e = [diamond(0, 0).pts[0], diamond(n - 1, 0).pts[1], diamond(n - 1, n - 1).pts[2], diamond(0, n - 1).pts[3]];
    ctx.lineWidth = 6 * cam.z;
    poly(e, null, 'rgba(30,50,20,0.18)');
    ctx.lineWidth = 1;
  }

  // Deniz kareleri tek parça dokuyla boyanır (kare kare çizilince şerit şerit görünüyordu)
  function seaFill(test, v) {
    ctx.beginPath();
    let any = false;
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        if (!test(x, y)) continue;
        any = true;
        const d = diamond(x, y, -0.01);
        ctx.moveTo(d.pts[0][0], d.pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(d.pts[i][0], d.pts[i][1]);
        ctx.closePath();
      }
    }
    if (!any) return;
    ctx.fillStyle = texture('deniz', 3) || '#3fa3a6';
    ctx.fill();
  }

  // Ana caddenin orta şeridi (cadde kuzey-güney uzanır: x sabit)
  function avenueLine(x, y) {
    const [ax, ay] = toScreen(x + 0.5, y + 0.12), [bx, by] = toScreen(x + 0.5, y + 0.88);
    ctx.strokeStyle = 'rgba(245,240,225,0.85)';
    ctx.lineWidth = 1.3 * cam.z;
    ctx.setLineDash([3.5 * cam.z, 3.5 * cam.z]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGround(s, view) {
    const n = CONFIG.gridSize;
    // yalnız ekrandaki kareler (harita 36x36; hepsini her karede çizmek yavaş)
    const vt = visibleTiles(2);
    const gx0 = Math.max(0, vt.x0), gx1 = Math.min(n - 1, vt.x1), gy0 = Math.max(0, vt.y0), gy1 = Math.min(n - 1, vt.y1);
    // açık arsaların çimi tek parça çizilir (kareler arasında çizgi kalmaz)
    const lawnName = SEASON_GROUND[G.season()][0];
    const lawn = texture(lawnName, lawnName === 'kar' ? 2.6 : 2.2) || texture('cim', 2.2);
    ctx.beginPath();
    for (let y = gy0; y <= gy1; y++) {
      for (let x = gx0; x <= gx1; x++) {
        if (!G.isUnlocked(s, x, y)) continue;
        const d = diamond(x, y, -0.01);
        ctx.moveTo(d.pts[0][0], d.pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(d.pts[i][0], d.pts[i][1]);
        ctx.closePath();
      }
    }
    ctx.fillStyle = lawn || GROUND.grassA;
    ctx.fill();
    // sonbaharda çim biraz sararır
    if (G.season() === 'sonbahar') { ctx.fillStyle = 'rgba(190,130,30,0.16)'; ctx.fill(); }
    seaFill((x, y) => G.terrainAt(x, y) === 'deniz', { x0: gx0, x1: gx1, y0: gy0, y1: gy1 });
    // kilitli arsalarda ayrıca biraz koyu yabani çayır (yükü doku zaten taşıyor)
    for (let y = gy0; y <= gy1; y++) {
      for (let x = gx0; x <= gx1; x++) {
        const d = diamond(x, y);
        const unlocked = G.isUnlocked(s, x, y);
        let fill = null; // çim ve çayır dokuyla çizildi
        const b = G.buildingAt(s, x, y);
        const ter = G.terrainAt(x, y);
        const bridge = G.isAvenue(x, y) && G.terrainAt(x - 1, y) === 'nehir';
        const hood = HOODS[G.hoodAt(x, y)] || {};
        let terImg = ter === 'deniz' ? null : ter ? sprites[TERRAIN[ter].sprite] : bridge ? sprites[TERRAIN.nehir.sprite] : null;
        // Sanayi ve İş Merkezi'nde açık arsalar beton
        const road = b && G.isRoadType(b.type) ? b.type : null;
        // döner kavşağın kareleri: zemin çizilir, görsel ayrıca 3x3 tek parça (drawRoundabouts)
        const ringImg = road && G.sizeOf(road) === 3 && sprites['yol-kavsak'];
        // görselli yol: bant karenin ortasından geçer, kenarında zemin görünür
        const avenue = G.isAvenue(x, y);
        const onRiver = ter === 'nehir' || bridge;
        const roadImg = avenue ? roadSprite(s, x, y, avenueKind(), onRiver) : road && (!ter || ter === 'nehir' || ter === 'tepe') ? roadSprite(s, x, y, road, onRiver) : null;
        if (!terImg && ter !== 'deniz' && hood.groundTile && unlocked && (!(avenue || road) || roadImg || ringImg)) terImg = sprites[hood.groundTile] || null;
        if (roadImg || ringImg) fill = null;
        else if (avenue) fill = GROUND.avenue;
        else if (road) fill = !G.isRoadConnected(s, x, y) ? GROUND.roadOff : road === 'yol-tas' ? GROUND.cobble : GROUND.road;
        if (terImg) {
          drawTile(x, y, terImg);
          // kışın nehir kıyısı ve tepeler karla örtülür
          if (G.season() === 'kis' && (ter === 'nehir' || ter === 'tepe' || bridge)) poly(d.pts, 'rgba(240,246,255,0.55)');
          if (!unlocked) poly(d.pts, 'rgba(25,45,20,0.32)');
          else if (ter === 'tepe' && !b) poly(d.pts, null, 'rgba(40,70,30,0.12)');
        }
        if (onRiver && roadImg) {
          drawSquare(x, y, roadImg);
        } else if (bridge) {
          // cadde nehrin üstünden köprüyle geçer
          const bd = diamond(x, y, 0.1);
          poly(bd.pts, GROUND.avenue, '#3c414a');
        } else if (road && ter === 'nehir') {
          drawBridge(x, y, fill);
        } else if (fill) {
          poly(d.pts, fill);
          if (road) drawRoadStyle(x, y, road);
        }
        if (roadImg && !onRiver) drawSquare(x, y, roadImg);
        // cadde görseli yoksa (asfalt yolla çiziliyorsa) orta şerit kodla, yalnız düz parçada
        if (avenue && (!roadImg || roadImg === sprites['yol-yol-5'])) avenueLine(x, y);
        // ızgara yalnız inşa ederken ve yol yaparken görünür
        if (view.grid && unlocked && !road && !G.isAvenue(x, y)) {
          ctx.lineWidth = 1;
          poly(d.pts, null, 'rgba(255,255,255,0.22)');
        }
      }
    }
  }

  // Döner kavşaklar zeminin üstüne, binalardan önce tek parça çizilir
  function drawRoundabouts(s) {
    const img = sprites['yol-kavsak'];
    if (!img) return;
    for (const b of Object.values(s.buildings)) {
      if (!G.isRoadType(b.type) || G.sizeOf(b) !== 3) continue;
      const off = !G.isRoadConnected(s, b.x + 1, b.y); // halka kendi içinde bağlı: bir karesi yeter
      drawSquare(b.x, b.y, off ? sprites['yol-kavsak-off'] : img, 3);
    }
  }

  // Komşu yollara göre parça: kuzey (y-1) 1, doğu (x+1) 2, güney (y+1) 4, batı (x-1) 8
  // Ana cadde kendi görseliyle (cadde-*), yüklenmediyse asfalt yolla çizilir
  function avenueKind() { return sprites['yol-cadde-5'] ? 'cadde' : 'yol'; }

  // Nehirdeki kare (onRiver): kuzeye ya da güneye bağlıysa köprü görseli
  function roadSprite(s, x, y, type, onRiver = false) {
    if (type !== 'cadde' && !ROAD_IMAGE_TYPES.includes(type)) return null;
    const isRoad = (nx, ny) => {
      if (!G.inBounds(nx, ny)) return outsideAvenue(nx, ny);
      if (G.isAvenue(nx, ny)) return true;
      return G.roadLink(s, x, y, nx, ny); // döner kavşağa yalnız kol ucundan bağlanır
    };
    const m = (isRoad(x, y - 1) ? 1 : 0) | (isRoad(x + 1, y) ? 2 : 0) | (isRoad(x, y + 1) ? 4 : 0) | (isRoad(x - 1, y) ? 8 : 0);
    const off = !G.isAvenue(x, y) && G.inBounds(x, y) && !G.isRoadConnected(s, x, y);
    // köprü hep kuzey-güney düz; yanındaki yollar köprüye bağlanmaz (nehir boyunca giden yolda kodla çizilen köprü)
    if (onRiver) return m & 5 ? sprites[`yol-${type}-kopru${off ? '-off' : ''}`] || null : null;
    return sprites[`yol-${type}-${m}${off ? '-off' : ''}`] || null;
  }

  // Tam üstten çizilmiş kare görseli karenin baklavasına yatır (sol üst köşe = karenin üst ucu)
  function drawSquare(x, y, img, tiles = 1) {
    const [sx, sy] = toScreen(x, y);
    const n = (img.naturalWidth || img.width) / tiles;
    const a = (TW / 2) * cam.z / n, b = (TH / 2) * cam.z / n;
    ctx.save();
    ctx.transform(a, b, -a, b, sx, sy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // Yol türlerinin süsü: Arnavut kaldırımı taş deseni, bulvarda kenar ağaçları
  function drawRoadStyle(x, y, type) {
    if (type === 'yol-tas') {
      ctx.fillStyle = 'rgba(60,45,35,0.22)';
      for (let i = 0; i < 9; i++) {
        const fx = x + 0.18 + (i % 3) * 0.32, fy = y + 0.18 + Math.floor(i / 3) * 0.32;
        const [px, py] = toScreen(fx, fy);
        ctx.beginPath(); ctx.ellipse(px, py, 4 * cam.z, 2 * cam.z, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (type === 'bulvar') {
      // kenarlarda yeşil şerit ve küçük ağaçlar
      for (const [fx, fy] of [[x + 0.12, y + 0.12], [x + 0.88, y + 0.88]]) {
        const [px, py] = toScreen(fx, fy);
        ctx.fillStyle = '#4f9a3c';
        ctx.beginPath(); ctx.arc(px, py - 5 * cam.z, 5 * cam.z, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6fbf4a';
        ctx.beginPath(); ctx.arc(px - 1.5 * cam.z, py - 6.5 * cam.z, 3 * cam.z, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Nehir üstündeki yol: taş köprü
  function drawBridge(x, y, fill) {
    const deck = diamond(x, y, 0.18);
    const [a, b2, c, d] = deck.pts;
    const h = 5 * cam.z;
    poly([d, c, [c[0], c[1] + h], [d[0], d[1] + h]], '#8d7b68');
    poly([c, b2, [b2[0], b2[1] + h], [c[0], c[1] + h]], '#76675a');
    poly(deck.pts, fill === GROUND.roadOff ? fill : '#b9a58c', '#6a5a4c');
    ctx.strokeStyle = '#5b4c40';
    ctx.lineWidth = 2 * cam.z;
    ctx.beginPath(); ctx.moveTo(a[0], a[1] - 3 * cam.z); ctx.lineTo(d[0], d[1] - 3 * cam.z); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b2[0], b2[1] - 3 * cam.z); ctx.lineTo(c[0], c[1] - 3 * cam.z); ctx.stroke();
  }

  // Zemin karesi görselini karenin baklavasına oturt (alt köşe = karenin alt köşesi)
  function drawTile(x, y, img) {
    const [sx, sy] = toScreen(x, y);
    const w = TW * cam.z;
    const h = w * img.naturalHeight / img.naturalWidth;
    // görselin altındaki toprak kenar (~%6) karenin altına sarksın; üst yüzey zeminle aynı hizada kalsın
    const slab = w * 0.06;
    ctx.drawImage(img, sx - w / 2, sy + TH * cam.z - h + slab, w, h);
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

  // Kapalı parseller: açık mahallede fiyatlı kesik çerçeve; kapalı mahallede koyu örtü ve
  // mahallenin ortasında tek etiket (ad, gereken seviye ya da açılış fiyatı)
  function drawParcels(s, labels = false) {
    const p = CONFIG.parcelSize;
    const max = CONFIG.gridSize / p;
    const vt = visibleTiles(p);
    for (let py = 0; py < max; py++) {
      for (let px = 0; px < max; px++) {
        if (s.parcels.includes(`${px},${py}`)) continue;
        if ((px + 1) * p < vt.x0 || px * p > vt.x1 || (py + 1) * p < vt.y0 || py * p > vt.y1) continue;
        const hoodId = G.hoodOfParcel(px, py);
        const hoodOpen = G.hoodUnlocked(s, hoodId);
        const buyable = G.parcelBuyable(s, px, py);
        const a = diamond(px * p, py * p).pts[0];
        const b = diamond(px * p + p - 1, py * p).pts[1];
        const c = diamond(px * p + p - 1, py * p + p - 1).pts[2];
        const d = diamond(px * p, py * p + p - 1).pts[3];
        const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2;
        if (labels) {
          // fiyat yalnız açık arsaya komşu parsellerde (hepsinde olunca ekran kalabalıklaşıyor)
          const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.parcels.includes(`${px + dx},${py + dy}`));
          if (buyable && next) pill(cx, cy, `🔒 ${G.formatMoney(G.parcelCost(s, px, py))}`, 'rgba(22,32,48,0.78)', '#ffe08a', 11);
          continue;
        }
        if (!hoodOpen) { poly([a, b, c, d], 'rgba(15,30,15,0.30)'); continue; }
        if (!buyable) { poly([a, b, c, d], 'rgba(20,40,20,0.22)'); continue; }
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        poly([a, b, c, d], 'rgba(20,40,20,0.10)', 'rgba(255,255,255,0.55)');
        ctx.setLineDash([]);
      }
    }
    if (labels) {
      // kapalı mahallelerin etiketi
      for (const [id, hd] of Object.entries(HOODS)) {
        if (G.hoodUnlocked(s, id)) continue;
        const [hx, hy] = G.hoodCenter(id);
        const [sx, sy] = toScreen(hx, hy);
        if (sx < -120 || sx > W + 120 || sy < -60 || sy > H + 60) continue;
        pill(sx, sy, `${hd.icon} ${hd.name}`, 'rgba(22,32,48,0.85)', '#ffffff', 13);
        const sub = s.level < hd.unlock ? `🔒 Seviye ${hd.unlock}` : `Aç · ${G.formatMoney(hd.openCost)} 🪙`;
        pill(sx, sy + 24 * Math.min(cam.z, 1.4) + 4, sub, 'rgba(22,32,48,0.72)', '#ffe08a', 11);
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
  function buildingTop(b) {
    const type = typeof b === 'string' ? b : b.type;
    const img = typeof b === 'string' ? sprites[type] : spriteOf(b);
    const n = G.sizeOf(type);
    if (img) return TW * cam.z * n * (BUILDINGS[type].spriteScale || 1) * img.naturalHeight / img.naturalWidth - TH * cam.z * n;
    return (BUILDINGS[type].height || 0) * cam.z;
  }

  function spriteOf(b) {
    return sprites[G.spriteKey(b)] || sprites[b.type];
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
    const img = spriteOf(b);
    if (img) return drawSprite(b, img, alpha, selected, tint);
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
    if (icon instanceof Image) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 2.5, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(icon, cx - r + 2.5, cy - r + 2.5, (r - 2.5) * 2, (r - 2.5) * 2);
      ctx.restore();
    }
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
    if (!(icon instanceof Image)) ctx.fillText(icon, cx, cy + 1);
  }

  // Ziyaretçi: binanın üstünde zıplayan büyük portre ve küçük işaret
  let visitorSpot = null; // dokunma için son çizilen ziyaretçi balonu
  function drawVisitor(s, t) {
    const v = G.visitorHere(s);
    visitorSpot = null;
    if (!v) return;
    const b = v.building;
    const n = G.sizeOf(b);
    const [sx, sy] = toScreen(b.x + n / 2, b.y + n / 2);
    const top = sy - buildingTop(b) - 30 * Math.max(0.8, cam.z) - Math.abs(Math.sin(t / 300)) * 6 * cam.z;
    ctx.save();
    ctx.translate(sx, top);
    ctx.scale(1.5, 1.5);
    bubble(0, 0, sprites[v.def.portrait] || v.def.icon, null, null, '#fff6d6');
    ctx.restore();
    const r = 11 * Math.max(0.8, cam.z) * 1.5;
    visitorSpot = { x: sx, y: top, r: r + 8 };
    ctx.save();
    ctx.translate(sx + r * 0.8, top - r * 0.8);
    bubble(0, 0, G.visitorCheck(s)?.met ? '✅' : '❕', null, null, '#ffffff');
    ctx.restore();
  }

  function satColor(v) {
    if (v >= CONFIG.satHappy) return '#2fbf71';
    if (v >= 40) return '#f2b134';
    return '#e5534b';
  }

  function drawStatus(s, b, t) {
    const d = BUILDINGS[b.type];
    const [sx, sy] = toScreen(b.x, b.y);
    const top = sy - buildingTop(b) - 4 * cam.z;
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
        bubble(sx, top, sprites[`kiraci-${c.tenant}`] || TENANTS[c.tenant].icon, p, satColor(G.satisfaction(s, b)));
      } else if (st === 'yenileme') bubble(sx, top, '🔁', null, null, '#e6f6ff');
      else bubble(sx, top, '🔑', null, null, '#ffffff');
      // kiracının özel isteği
      if (b.story) {
        ctx.save(); ctx.translate(sx + 16 * Math.max(0.8, cam.z), top - 6 * cam.z); ctx.scale(pulse * 0.85, pulse * 0.85);
        bubble(0, 0, '📜', null, null, '#ffe7b8');
        ctx.restore();
      }
    } else if (G.hasIncome(b)) {
      if (!G.isConnected(s, b)) bubble(sx, top, '⚠️', null, null, '#fff3cd');
      else if (G.isCollectable(s, b)) {
        ctx.save(); ctx.translate(sx, top); ctx.scale(pulse, pulse);
        bubble(0, 0, '🪙', (b.stored || 0) / G.storageCap(b), '#f2b134', '#fff6d6');
        ctx.restore();
      }
    } else if (G.isProducer(b)) {
      // üretim: çıktının simgesi ve döngü halkası; girdi yoksa ya da depo doluysa uyarı
      const st = G.producerStatus(s, b);
      const out = Object.keys(d.produce.outputs)[0];
      if (st === 'baglantisiz') bubble(sx, top, '⚠️', null, null, '#fff3cd');
      else if (st === 'girdi') bubble(sx, top, '❗', null, null, '#ffe2d6');
      else if (st === 'dolu') bubble(sx, top, '📦', null, null, '#ffe2d6');
      else bubble(sx, top, RESOURCES[out].icon, Math.min(1, (b.prog || 0) / G.cycleMs(b)), '#3d8bd9', '#eef5ff');
    }
    // yükseltilmiş binanın seviyesi
    if (b.level > 1) pill(sx + 18 * cam.z, sy + 4 * cam.z, '★'.repeat(b.level - 1), 'rgba(22,32,48,0.75)', '#ffd54a', 9);
  }

  // Harita dışındaki kuşakta ve kilitli arsalarda ağaç, çalı, kaya.
  // front: harita kenarının önünde kalanlar (binalardan sonra çizilir)
  function natureItems(s, t, sway, which) {
    const n = CONFIG.gridSize;
    const v = visibleTiles(4);
    const back = [], inside = [], front = [];
    const x0 = Math.max(v.x0, -RING), x1 = Math.min(v.x1, n - 1 + RING);
    const y0 = Math.max(v.y0, -RING), y1 = Math.min(v.y1, n - 1 + RING);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let count;
        const inMap = G.inBounds(x, y);
        if (inMap !== (which === 'inside')) continue;
        if (inMap) {
          const ter = G.terrainAt(x, y);
          if (G.isUnlocked(s, x, y) || G.isAvenue(x, y) || (ter && !TERRAIN[ter].buildable) || ter === 'kum') continue;
          count = hash(x, y) < 0.35 ? 1 : 0; // kilitli arsada yalnız alçak çalı ve çiçek: arsa görünsün, dokunması kolay olsun
        } else {
          if (outsideTerrain(x, y) || outsideAvenue(x, y) || outsideAvenue(x - 1, y) || outsideAvenue(x + 1, y)) continue;
          // kenardan uzaklaştıkça orman sıklaşır
          const dist = Math.max(-x, -y, x - n + 1, y - n + 1);
          const dens = Math.min(0.75, dist < 2 ? 0.1 : 0.15 + (dist - 2) * 0.12);
          const h = hash(x, y);
          count = h < dens ? (h < dens * 0.45 ? 3 : 2) : 0; // ağaçlar küçük, kare başına daha çok
        }
        for (let k = 0; k < count; k++) {
          const fx = x + 0.2 + hash(x, y, 2 + k) * 0.6;
          const fy = y + 0.2 + hash(x, y, 5 + k) * 0.6;
          let pick = hash(x, y, 13 + k) * NATURE_TOTAL, kind = 'kuknar';
          for (const [name, nd] of Object.entries(NATURE)) { pick -= nd.weight; if (pick < 0) { kind = name; break; } }
          if (inMap) kind = hash(x, y, 17) < 0.6 ? 'cali' : 'cicekler';
          const alt = SEASON_TREES[G.season()]?.[kind];
          if (alt === null) continue;
          const img = sprites[`doga-${alt || kind}`] || sprites[`doga-${kind}`];
          if (!img) continue;
          const size = (0.62 + hash(x, y, 9 + k) * 0.35) * TREE_SCALE;
          const [sx, sy] = toScreen(fx, fy);
          const w = NATURE[kind].w * TW * cam.z * size;
          const hgt = w * img.naturalHeight / img.naturalWidth;
          if (sx + w < 0 || sx - w > W || sy - hgt > H || sy < -10) continue;
          const phase = hash(x, y, 11 + k) * 6.28;
          const item = { key: fx + fy, kx: fx, draw: () => drawNature(img, kind, sx, sy, w, hgt, sway ? Math.sin(t / 1100 + phase) * 0.035 * NATURE[kind].sway : 0) };
          (inMap ? inside : (x >= n || y >= n) ? front : back).push(item);
        }
      }
    }
    const byKey = (a, b) => a.key - b.key || a.kx - b.kx;
    back.sort(byKey); front.sort(byKey);
    return { back, inside, front };
  }

  function drawNature(img, kind, sx, sy, w, h, shear) {
    if (kind !== 'cicekler') {
      ctx.fillStyle = 'rgba(20,40,15,0.24)';
      ctx.beginPath();
      ctx.ellipse(sx + w * 0.08, sy, w * 0.42, w * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (shear) {
      // tepesi rüzgârla hafifçe yana yatar, dibi yerinde kalır
      ctx.setTransform(dpr, 0, dpr * shear, dpr, -dpr * shear * sy, 0);
      ctx.drawImage(img, sx - w / 2, sy - h * 0.96, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx.drawImage(img, sx - w / 2, sy - h * 0.96, w, h);
    }
  }

  // Harita dışı (çayır, uzanan su, orman) sabittir: ekrandan biraz büyük bir ara belleğe
  // bir kez çizilir, kaydırırken yalnız yeri değişir. Yakınlaşma bitince ya da kenara
  // gelince yeniden çizilir. back: haritanın arkası, front: haritanın önündeki ağaçlar.
  const scenery = { back: document.createElement('canvas'), front: document.createElement('canvas'), key: '', at: 0 };
  function sceneryKey() {
    return `${G.season()}|${W}|${H}|${Object.keys(sprites).length}`;
  }
  function renderScenery(s, now) {
    const M = Math.round(Math.max(W, H) * 0.22);
    const ld = dpr; // ekranla aynı çözünürlük: her karede ölçeklemeden kopyalanır
    const save = { ctx, W, H, dpr, x: cam.x, y: cam.y };
    const cw = W + 2 * M, ch = H + 2 * M;
    for (const cv of [scenery.back, scenery.front]) {
      if (cv.width !== Math.round(cw * ld) || cv.height !== Math.round(ch * ld)) { cv.width = Math.round(cw * ld); cv.height = Math.round(ch * ld); }
    }
    W = cw; H = ch; dpr = ld; cam.x += M; cam.y += M;
    try {
      ctx = scenery.back.getContext('2d');
      ctx.setTransform(ld, 0, 0, ld, 0, 0);
      drawOutside();
      const nat = natureItems(s, 0, false, 'outside');
      for (const it of nat.back) it.draw();
      ctx = scenery.front.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, scenery.front.width, scenery.front.height);
      ctx.setTransform(ld, 0, 0, ld, 0, 0);
      for (const it of nat.front) it.draw();
    } finally {
      ({ ctx, W, H, dpr } = save);
      cam.x = save.x; cam.y = save.y;
    }
    Object.assign(scenery, { key: sceneryKey(), x: cam.x, y: cam.y, z: cam.z, M, cw, ch, at: now });
  }
  function updateScenery(s, now) {
    if (scenery.key !== sceneryKey()) return renderScenery(s, now);
    const k = cam.z / scenery.z;
    // ara bellek ekranı hâlâ kaplıyor mu?
    const left = cam.x - (scenery.x + scenery.M) * k, top = cam.y - (scenery.y + scenery.M) * k;
    const covers = left <= 0 && top <= 0 && left + scenery.cw * k >= W && top + scenery.ch * k >= H;
    if (!covers || (k !== 1 && now - scenery.zoomAt > 160)) renderScenery(s, now);
  }
  function drawSceneryLayer(cv) {
    const k = cam.z / scenery.z;
    if (k === 1) {
      // piksele hizalı kopya (ölçekleme yok, en hızlısı)
      const px = Math.round((cam.x - scenery.x - scenery.M) * dpr), py = Math.round((cam.y - scenery.y - scenery.M) * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cv, px, py);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    ctx.drawImage(cv, cam.x - (scenery.x + scenery.M) * k, cam.y - (scenery.y + scenery.M) * k, scenery.cw * k, scenery.ch * k);
  }

  function draw(s, view, t, amb = null) {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scenery.lastZ !== cam.z) { scenery.zoomAt = t; scenery.lastZ = cam.z; }
    updateScenery(s, t);
    drawSceneryLayer(scenery.back);
    drawGround(s, view);
    drawRoundabouts(s);
    drawParcels(s);
    const nature = natureItems(s, t, !!(amb && amb.enabled), 'inside');

    const pl = view.placement;
    const sel = view.selectedId ? s.buildings[view.selectedId] : null;
    if (pl && !G.isRoadType(pl.type)) drawInfluence(s, pl);
    else if (sel) drawInfluence(s, sel);

    // binalar, ağaçlar, arabalar, insanlar: arkadan öne (karenin merkezine göre)
    const list = Object.values(s.buildings).filter(b => !G.isRoadType(b.type) && (!pl || b.id !== pl.moveId));
    const keyOf = b => { const n = G.sizeOf(b.type); return { key: b.x + b.y + n, kx: b.x + n / 2 }; };
    const items = list.map(b => ({ b, ghost: false, ...keyOf(b) }));
    if (pl && !G.isRoadType(pl.type)) {
      const g = { id: '_ghost', type: pl.type, x: pl.x, y: pl.y };
      items.push({ b: g, ghost: true, ...keyOf(g) });
    }
    const all = (amb ? items.concat(amb.drawables(s, t)) : items).concat(nature.inside);
    all.sort((a, b) => a.key - b.key || a.kx - b.kx);
    for (const it of all) {
      if (it.draw) it.draw();
      else if (it.ghost) drawBuilding(it.b, 0.82, true, pl.valid ? null : '#e5534b');
      else drawBuilding(it.b, 1, sel && sel.id === it.b.id);
    }

    drawSceneryLayer(scenery.front);
    if (amb) amb.drawOverlay(t);
    drawParcels(s, true); // fiyat etiketleri ağaçların üstünde kalsın

    if (!pl) for (const it of items) drawStatus(s, it.b, t);
    if (!pl) drawVisitor(s, t);

    if (pl && !G.isRoadType(pl.type)) drawPlacementPreview(s, pl);

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
        const top = sy - buildingTop(h) - 6 * cam.z;
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
    cam, ctx, resize, draw, screenToTile, centerOn, zoomAt, pan, toScreen, poly, buildingTop, fitZoom,
    get size() { return { W, H }; },
    hitVisitor(x, y) { return !!visitorSpot && Math.hypot(x - visitorSpot.x, y - visitorSpot.y) <= visitorSpot.r; },
  };
}
