// Oyunun ekranı: döngü, dokunma, menüler. Kurallar game.js'te, rakamlar data.js'te.
import { CONFIG, BUILDINGS, TENANTS, CATEGORIES, QUESTS, COLLECTION, HOODS, STORIES, RESOURCES, ACHIEVEMENTS, INDUSTRY, VISITORS, SEASONS } from './data.js';
import * as G from './game.js';
import { createRenderer, loadSprites } from './render.js';
import { createAmbient } from './ambient.js';
import * as A from './audio.js';

const SAVE_KEY = 'emlak-sehri-kayit-v1';
const $ = id => document.getElementById(id);

const canvas = $('city');
const R = createRenderer(canvas);
const AMB = createAmbient(R);
const PREF_KEY = 'emlak-sehri-ayar-v1';
const view = { selectedId: null, placement: null, floaters: [] };
let s = null;
let mode = 'normal'; // normal | place | road
let roadErase = false;
let roadType = 'yol';
let panel = null;
let lastWall = Date.now();

// ---------- Kayıt ----------

function loadSave(hotData) {
  try {
    const raw = hotData?.save || localStorage.getItem(SAVE_KEY);
    if (raw) return G.deserialize(raw);
  } catch (e) { /* kayıt okunamadı: yeni oyun */ }
  return null;
}

// Hareket ayarı oyun kaydından ayrı tutulur (cihaz ayarı)
// Cihaz ayarları (oyun kaydından ayrı): hareket, efekt sesi, müzik
const prefs = { motion: true, sfx: true, music: true };

function loadPrefs() {
  prefs.motion = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    for (const k of Object.keys(prefs)) if (typeof p[k] === 'boolean') prefs[k] = p[k];
  } catch (e) { /* varsayılan */ }
  AMB.enabled = prefs.motion;
  A.setSfx(prefs.sfx);
  A.setMusic(prefs.music);
}

function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* depolama kapalı */ }
}

function setMotion(on) {
  prefs.motion = on;
  AMB.enabled = on;
  savePrefs();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, G.serialize(s)); } catch (e) { /* depolama kapalı olabilir */ }
}

// ---------- Başlangıç ----------

// Açılışta bir mahallenin çoğu ekrana sığar (yaklaşık 14 kare genişlik)
function startZoom() {
  return G.clamp(R.size.W / (14 * 64), R.fitZoom(), 2);
}

function centerHood(id, z) {
  const [hx, hy] = G.hoodCenter(id);
  R.centerOn(hx, hy, z);
}

function start(hotData = {}) {
  const loaded = loadSave(hotData);
  s = loaded || G.createState();
  R.resize();
  centerHood(s.hood || 'eski', startZoom());

  if (loaded) {
    const before = s.gameTime;
    G.advance(s, Math.max(0, Date.now() - s.savedAt));
    const sum = G.awaySummary(s, before);
    if (sum.elapsed > 60 * 1000 && (sum.readyHouses || sum.income > 0)) showAway(sum);
  } else {
    showWelcome();
  }
  s.events.length = 0;
  if (s.migratedRefund !== undefined) {
    // tek haritaya geçiş: eski kayıt taşındı
    setTimeout(() => toast(`Şehrin artık tek büyük harita! Mahalleler yan yana.${s.migratedRefund ? ` Sığmayan binaların parası iade edildi: ${G.formatMoney(s.migratedRefund)} 🪙` : ''}`), 1200);
    delete s.migratedRefund;
  }
  lastWall = Date.now();
  bindUi();
  loadPrefs();
  loadSprites();
  requestAnimationFrame(frame);
  setInterval(save, 5000);
  window.claude?.hot?.snapshot?.(() => ({ save: G.serialize(s) }));
  // testler ve hata ayıklama için
  window.__emlak = { state: () => s, renderer: R, ambient: AMB };
}

function frame(t) {
  const now = Date.now();
  G.advance(s, now - lastWall);
  G.applyTestMode(s);
  lastWall = now;
  drainEvents(t);
  updateHud();
  panelTick();
  view.floaters = view.floaters.filter(f => t - f.t0 < 1200);
  AMB.update(s, t);
  R.draw(s, view, t, AMB);
  requestAnimationFrame(frame);
}

// ---------- Olaylar ----------

function drainEvents(t) {
  const evs = s.events.splice(0);
  for (const e of evs) {
    const SOUND = { collected: 'coin', built: 'build', signed: 'sign', levelUp: 'levelUp', storyStarted: 'news', storyDone: 'chime', marketEvent: 'news', collectionDrop: 'chime', hoodOpened: 'chime' };
    if (SOUND[e.type] && !(e.type === 'built' && e.buildingType === 'yol')) A.play(SOUND[e.type]);
    if (e.type === 'collected') {
      view.floaters.push({ x: e.x, y: e.y, text: `+${G.formatMoney(e.amount)} 🪙`, t0: t });
      AMB.burst(e.x, e.y, e.amount);
      buzz(12);
    } else if (e.type === 'levelUp') {
      showLevelUp(e.level, e.reward, e.diamonds);
    } else if (e.type === 'achievement') {
      A.play('chime');
      toast(`🏆 Başarım: ${e.text}! ${e.reward.diamonds ? `+${e.reward.diamonds} elmas` : ''}${e.reward.money ? `+${G.formatMoney(e.reward.money)} 🪙` : ''}`);
    } else if (e.type === 'upgraded') {
      view.floaters.push({ x: e.x, y: e.y, text: `★ Seviye ${e.level}`, t0: t, color: '#ffd54a' });
      AMB.burst(e.x, e.y, 400);
    } else if (e.type === 'storyStarted') {
      view.floaters.push({ x: e.x, y: e.y, text: '📜 yeni istek', t0: t + 600, color: '#ffd9a8' });
      toast(`📜 Bir kiracın istekte bulundu: ${e.title} Eve dokun.`);
    } else if (e.type === 'storyDone') {
      if (e.unlock) showRareUnlocked(e.unlock);
      else toast('Kiracın çok mutlu! Ödül alındı.');
    } else if (e.type === 'storyExpired') {
      toast('Bir kiracının isteğinin süresi doldu.', true);
    } else if (e.type === 'marketEvent') {
      const where = e.hood === s.hood ? '' : `${HOODS[e.hood].name}: `;
      toast(`📰 ${where}${e.text} (${e.effect > 0 ? '+' : ''}${e.effect} endeks)`, e.effect < 0);
    } else if (e.type === 'hoodOpened') {
      toast(`${HOODS[e.id].name} açıldı! İlk arsası hazır.`);
    } else if (e.type === 'collectionDrop') {
      const it = COLLECTION[e.item];
      view.floaters.push({ x: e.x, y: e.y, text: `+1 ${it.name}`, t0: t + 400, color: '#bde7ff' });
      toast(`Koleksiyon parçası buldun: ${it.name}! (Menü → Koleksiyon)`);
    } else if (e.type === 'visitor') {
      const v = VISITORS[e.visitor];
      A.play('news');
      view.floaters.push({ x: e.x, y: e.y, text: `${v.icon} ziyaretçi`, t0: t, color: '#ffe08a' });
      toast(`${v.icon} ${v.name} şehrine geldi! Binanın üstündeki portreye dokun.`);
    } else if (e.type === 'visitorLeft') {
      toast(`${VISITORS[e.visitor].name} bekleyemedi, şehirden ayrıldı.`, true);
    } else if (e.type === 'visitorHappy') {
      A.play('chime');
    } else if (e.type === 'season') {
      const se = SEASONS[e.id];
      toast(`${se.icon} ${se.name} geldi! ${se.text}`);
    } else if (e.type === 'tenantLeft') {
      toast('Bir kiracı memnun kalmadığı için ayrıldı. Kirası yine de toplandı.', true);
    }
  }
}

function buzz(ms) {
  try { navigator.vibrate?.(ms); } catch (e) { /* titreşim yok */ }
}

// ---------- Üst gösterge ----------

// Büyük sayılar üst göstergede kısa yazılır: 125.400 → 125 B, 2.300.000 → 2,3 Mn
const compactFmt = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
function compact(n) {
  return n >= 100000 ? compactFmt.format(Math.round(n)) : G.formatMoney(n);
}

const hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).textContent = v;
}

function updateHud() {
  // ekranın ortasındaki mahalle: fiyatlar ve endeks bunu gösterir
  const [cx, cy] = R.screenToTile(R.size.W / 2, R.size.H * 0.45);
  const here = G.hoodAt(cx, cy);
  if (here) G.setViewHood(s, here);
  setText('money', compact(s.money));
  setText('diamonds', String(s.diamonds));
  setText('hoodName', G.activeHood(s).short || G.activeHood(s).name);
  setText('hoodIcon', G.activeHood(s).icon);
  setText('level', String(s.level));
  setText('worth', compact(G.netWorth(s)));
  const pct = Math.min(100, (s.xp / G.xpToNext(s.level)) * 100);
  const w = `${pct.toFixed(1)}%`;
  if (hudCache.xp !== w) { hudCache.xp = w; $('xpfill').style.width = w; }

  G.ensureDaily(s);
  G.ensureWeekly(s);
  setText('seasonIcon', SEASONS[G.season()].icon);
  $('seasonBtn').hidden = mode !== 'normal';
  const dDone = s.daily.goals.filter(g => g.claimed).length;
  const ready = G.dailyReadyCount(s) + G.weeklyReadyCount(s);
  setText('dailyProg', `${dDone}/${s.daily.goals.length}`);
  $('dailyBtn').classList.toggle('ready', ready > 0);
  $('dailyBtn').hidden = mode !== 'normal';

  const q = G.currentQuest(s);
  const qEl = $('quest');
  qEl.hidden = !q || mode !== 'normal';
  if (q) {
    const done = G.questComplete(s);
    setText('questText', done ? `${q.text} — ödülü al!` : q.text);
    const prog = Math.min(G.questProgress(s, q), q.n);
    setText('questProg', q.kind === 'netWorth' ? '' : `${prog}/${q.n}`);
    qEl.classList.toggle('done', done);
  }
}

// ---------- Bildirim ----------

let toastTimer = 0;
function toast(msg, bad = false) {
  if (bad) A.play('error');
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function result(r, okMsg) {
  if (!r.ok) { if (r.msg) toast(r.msg, true); return false; }
  if (okMsg) toast(okMsg);
  return true;
}

// ---------- Dokunma ----------

const pointers = new Map();
let gesture = null;

function localXY(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function onDown(e) {
  canvas.setPointerCapture?.(e.pointerId);
  const [x, y] = localXY(e);
  pointers.set(e.pointerId, { x, y });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (pointers.size > 2) return;
  const [tx, ty] = R.screenToTile(x, y);
  const b = G.buildingAt(s, tx, ty);

  // Yol modunda: yoldan (ya da ana caddeden) başlayan sürükleme yol çizer/siler,
  // boş yerden başlayan sürükleme haritayı kaydırır, dokunmak tek kare yol koyar.
  if (mode === 'road' && ((b && G.isRoadType(b.type)) || G.isAvenue(tx, ty))) {
    gesture = { kind: 'road', sx: x, sy: y, last: `${tx},${ty}`, first: true };
    if (roadErase) paintRoad(tx, ty, true);
    return;
  }
  if (mode === 'place' && view.placement && tx === view.placement.x && ty === view.placement.y) {
    gesture = { kind: 'ghost', sx: x, sy: y };
    return;
  }
  if (mode === 'normal' && b && G.isCollectable(s, b)) {
    G.collectAny(s, b.id);
    gesture = { kind: 'collect', done: new Set([b.id]), sx: x, sy: y };
    return;
  }
  gesture = { kind: 'tap', sx: x, sy: y, lx: x, ly: y, moved: false };
}

function onMove(e) {
  if (!pointers.has(e.pointerId)) return;
  const [x, y] = localXY(e);
  const p = pointers.get(e.pointerId);
  const dx = x - p.x, dy = y - p.y;
  p.x = x; p.y = y;
  if (!gesture) return;

  if (gesture.kind === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (gesture.dist > 0) R.zoomAt(mx, my, dist / gesture.dist);
    R.pan(mx - gesture.mx, my - gesture.my);
    gesture.dist = dist; gesture.mx = mx; gesture.my = my;
    return;
  }
  if (gesture.kind === 'tap') {
    if (!gesture.moved && Math.hypot(x - gesture.sx, y - gesture.sy) > 8) gesture.moved = true;
    if (gesture.moved) R.pan(dx, dy);
    return;
  }
  if (gesture.kind === 'collect') {
    const [tx, ty] = R.screenToTile(x, y);
    const b = G.buildingAt(s, tx, ty);
    if (b && !gesture.done.has(b.id) && G.isCollectable(s, b)) {
      gesture.done.add(b.id);
      G.collectAny(s, b.id);
    }
    return;
  }
  if (gesture.kind === 'road') {
    const [tx, ty] = R.screenToTile(x, y);
    const key = `${tx},${ty}`;
    if (key !== gesture.last) { gesture.last = key; paintRoad(tx, ty, false); }
    return;
  }
  if (gesture.kind === 'ghost') {
    // bina parmağın biraz üstünde dursun ki parmak görüşü kapatmasın
    const [tx, ty] = R.screenToTile(x, y - 46);
    setPlacement(tx, ty);
  }
}

function onUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && gesture.kind === 'tap' && !gesture.moved && pointers.size === 0) {
    if (mode === 'normal' && R.hitVisitor(gesture.sx, gesture.sy)) { A.play('tap'); openVisitor(); }
    else {
      const [tx, ty] = R.screenToTile(gesture.sx, gesture.sy);
      if (mode === 'road') paintRoad(tx, ty, true); else onTap(tx, ty);
    }
  }
  if (pointers.size === 0 || (gesture && gesture.kind === 'pinch')) gesture = null;
}

function onWheel(e) {
  e.preventDefault();
  const [x, y] = localXY(e);
  R.zoomAt(x, y, e.deltaY < 0 ? 1.1 : 1 / 1.1);
}

function onTap(tx, ty) {
  if (mode === 'place') { setPlacement(tx, ty); return; }
  if (!G.inBounds(tx, ty)) { deselect(); return; }
  if (!G.isUnlocked(s, tx, ty)) { const [px, py] = G.parcelOf(tx, ty); openParcel(px, py); return; }
  const b = G.buildingAt(s, tx, ty);
  if (b && G.isRoadType(b.type)) { openRoad(b.id); return; }
  if (b) { openBuilding(b.id); return; }
  if (G.isAvenue(tx, ty)) { toast('Ana cadde. Yollarını buna bağla.'); deselect(); return; }
  deselect();
}

function deselect() {
  view.selectedId = null;
  closeSheet();
}

// ---------- Yol ----------

function paintRoad(tx, ty, isFirst) {
  if (!G.inBounds(tx, ty)) return;
  const b = G.buildingAt(s, tx, ty);
  if (roadErase) {
    if (b && G.isRoadType(b.type)) G.sell(s, b.id);
    return;
  }
  if (G.sizeOf(roadType) > 1) {
    // döner kavşak: sürüklerken değil, dokununca; dokunulan kare ortası olur
    if (!isFirst) return;
    const r = G.build(s, roadType, tx - 1, ty - 1);
    if (!r.ok) toast(r.msg, true);
    return;
  }
  if (b || G.isAvenue(tx, ty)) return;
  const r = G.build(s, roadType, tx, ty);
  if (!r.ok && isFirst) toast(r.msg, true);
}

function setMode(m) {
  mode = m;
  $('btnRoad').classList.toggle('on', m === 'road');
  $('dock').hidden = m !== 'normal';
  $('placebar').hidden = m === 'normal';
  if (m !== 'place') view.placement = null;
  view.grid = m !== 'normal';
  if (m === 'road') { closeSheet(); view.selectedId = null; updateRoadBar(); }
}

function updateRoadBar() {
  const types = Object.entries(BUILDINGS).filter(([, d]) => d.cat === 'yol');
  const chips = types.map(([id, d]) => {
    const locked = d.unlock > s.level;
    return `<button type="button" class="chip road-type ${roadType === id ? 'on' : ''}" data-road="${id}" ${locked ? 'disabled' : ''}>${d.icon} ${d.name}${locked ? ` · Sv ${d.unlock}` : d.cost ? ` · ${d.cost}` : ' · bedava'}</button>`;
  }).join('');
  $('placeInfo').innerHTML = `<b>${roadErase ? 'Yol sil' : 'Yol yap'}</b><div class="road-types">${chips}</div>
    <span>${!roadErase && G.sizeOf(roadType) > 1
      ? 'Döner kavşak 3×3 kare kaplar: ortası olacak kareye dokun. Yollar yalnız dört kolun ucuna bağlanır.'
      : 'Dokununca yol konur. Yoldan ya da caddeden başlayıp sürükleyerek çiz; boş yerden sürüklersen harita kayar. Binalar bağlı bir yola komşu olmalı. Nehrin üstüne yol köprü olur.'}</span>`;
  for (const el of $('placeInfo').querySelectorAll('[data-road]')) {
    el.onclick = () => { roadType = el.dataset.road; roadErase = false; updateRoadBar(); };
  }
  $('placeCancel').textContent = roadErase ? 'Çizmeye dön' : 'Yol sil';
  $('placeOk').textContent = 'Bitti';
}

// ---------- Yerleştirme ----------

function startPlacement(type, moveId = null) {
  closeSheet();
  let x, y;
  if (moveId) ({ x, y } = s.buildings[moveId]);
  else {
    const spot = findSpot(type);
    if (!spot) { toast('Boş arsa kalmadı. Kilitli bir parsele dokunup yeni arsa aç.', true); return; }
    [x, y] = spot;
  }
  view.selectedId = null;
  view.placement = { type, x, y, moveId, valid: true };
  setMode('place');
  setPlacement(x, y);
}

// Ekranın ortasına en yakın, yola bağlanabilen boş kare
function findSpot(type) {
  const [cx, cy] = R.screenToTile(R.size.W / 2, R.size.H * 0.45);
  let best = null, bestScore = Infinity;
  const n = CONFIG.gridSize;
  const size = G.sizeOf(type);
  for (let y = Math.max(0, cy - 12); y < Math.min(n, cy + 13); y++) for (let x = Math.max(0, cx - 12); x < Math.min(n, cx + 13); x++) {
    if (!G.canPlace(s, x, y, null, size).ok) continue;
    const roadNext = connectedAt(x, y, size);
    const score = Math.hypot(x - cx, y - cy) + (roadNext ? 0 : 6);
    if (score < bestScore) { bestScore = score; best = [x, y]; }
  }
  return best;
}

function setPlacement(tx, ty) {
  const pl = view.placement;
  if (!pl || !G.inBounds(tx, ty)) return;
  pl.x = tx; pl.y = ty;
  const check = G.canPlace(s, tx, ty, pl.moveId, G.sizeOf(pl.type));
  pl.valid = check.ok;
  pl.reason = check.msg;
  updatePlacebar();
}

function connectedAt(x, y, size = 1) {
  return G.footprintNeighbors(x, y, size).some(([nx, ny]) => G.inBounds(nx, ny) && G.isRoadConnected(s, nx, ny));
}

function updatePlacebar() {
  const pl = view.placement;
  const d = BUILDINGS[pl.type];
  const cost = pl.moveId ? 0 : G.buildCost(s, pl.type, G.hoodAt(pl.x, pl.y) || s.hood);
  const lines = [];
  if (!pl.valid) lines.push(`<span style="color:var(--bad);font-weight:800">${pl.reason}</span>`);
  else if (!connectedAt(pl.x, pl.y, G.sizeOf(pl.type))) lines.push(`<span style="color:#a26b00;font-weight:700">⚠️ Burada yola bağlı olmaz. Sonra yanına yol yapabilirsin.</span>`);
  if (d.cat === 'konut') {
    const v = G.bonusAt(s, pl.x, pl.y, null, { ignoreId: pl.moveId }).total;
    lines.push(`<span>Konum bonusu: <b style="font-size:inherit;font-family:inherit">${pct(v)}</b> · kiracıya göre değişir</span>`);
  } else if (d.effect) {
    lines.push(`<span>${effectText(pl.type)}</span>`);
  }
  $('placeInfo').innerHTML = `<b>${d.icon} ${d.name}${pl.moveId ? ' taşınıyor' : ` · ${G.formatMoney(cost)} 🪙`}</b>${lines.join('')}
    <span style="color:var(--muted);font-size:12px">Başka kareye dokun ya da binayı sürükle.</span>`;
  $('placeOk').textContent = pl.moveId ? 'Buraya taşı' : 'Yerleştir';
  $('placeOk').disabled = !pl.valid;
  $('placeCancel').textContent = 'Vazgeç';
}

function confirmPlacement() {
  if (mode === 'road') { roadErase = false; setMode('normal'); return; }
  const pl = view.placement;
  if (!pl || !pl.valid) return;
  if (pl.moveId) {
    if (!result(G.move(s, pl.moveId, pl.x, pl.y), 'Taşındı.')) return;
    const id = pl.moveId;
    setMode('normal');
    openBuilding(id);
  } else {
    const r = G.build(s, pl.type, pl.x, pl.y);
    if (!r.ok && r.missing) {
      openMissing(G.matsFor(pl.type), () => confirmPlacement());
      return;
    }
    if (!result(r)) return;
    setMode('normal');
    openBuilding(r.id);
    buzz(20);
  }
  save();
}

function cancelPlacement() {
  if (mode === 'road') { roadErase = !roadErase; updateRoadBar(); return; }
  const id = view.placement?.moveId;
  setMode('normal');
  if (id) openBuilding(id);
}

// ---------- Alt kart ----------

function openSheet(p) {
  panel = p;
  panel.sigValue = p.sig ? p.sig() : '';
  $('sheetBody').innerHTML = p.render();
  $('sheet').hidden = false;
  $('sheet').scrollTop = 0;
}

function closeSheet() {
  panel = null;
  $('sheet').hidden = true;
}

let lastTick = 0;
function panelTick() {
  if (!panel) return;
  const now = performance.now();
  if (now - lastTick < 250) return;
  lastTick = now;
  if (panel.valid && !panel.valid()) { deselect(); return; }
  const sig = panel.sig ? panel.sig() : '';
  if (sig !== panel.sigValue) {
    const top = $('sheet').scrollTop;
    panel.sigValue = sig;
    $('sheetBody').innerHTML = panel.render();
    $('sheet').scrollTop = top;
    return;
  }
  if (panel.live) {
    const vals = panel.live();
    for (const el of $('sheetBody').querySelectorAll('[data-live]')) {
      const v = vals[el.dataset.live];
      if (v === undefined) continue;
      if (el.dataset.prop === 'width') el.style.width = v;
      else if (el.textContent !== v) el.textContent = v;
    }
  }
}

function onSheetClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !panel || el.disabled) return;
  const fn = panel.actions?.[el.dataset.act];
  if (fn) fn(el.dataset, el);
}

// ---------- Metin yardımcıları ----------

// Kiracı portresi; görsel yüklenemezse emoji kalır
function portrait(tenantId, size = 46) {
  const t = TENANTS[tenantId];
  return `<span class="portrait" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.56)}px">${t.icon}<img src="img/ui/kiraci-${tenantId}.png" alt="" onerror="this.remove()"></span>`;
}

function pct(v) {
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}%${Math.abs(v)}`;
}

function effectText(type) {
  const e = BUILDINGS[type].effect;
  if (!e) return '';
  const size = e.radius * 2 + G.sizeOf(type);
  const parts = [`Alan ${size}×${size}`];
  if (G.sizeOf(type) > 1) parts.unshift(`${G.sizeOf(type)}×${G.sizeOf(type)} kare kaplar`);
  if (e.all) parts.push(`herkese ${pct(e.all)}`);
  const t = Object.entries(e.tenants || {}).map(([id, v]) => `${TENANTS[id].name} ${pct(v)}`);
  if (t.length) parts.push(t.join(', '));
  return parts.join(' · ');
}

function satColor(v) {
  return v >= CONFIG.satHappy ? 'var(--good)' : v >= 40 ? '#e0a020' : 'var(--bad)';
}

function demandChip(met, demand) {
  if (!demand) return '<span class="chip">Talebi yok</span>';
  return `<span class="chip ${met ? 'good' : 'bad'}">${met ? '✓' : '✗'} ${G.demandText(demand)}</span>`;
}

// ---------- Sanayi yardımcıları ----------

function resChip(res, n, have = null) {
  const r = RESOURCES[res];
  const ok = have === null || have >= n;
  return `<span class="chip ${ok ? '' : 'bad'}">${r.icon} ${G.formatMoney(Math.ceil(n))} ${r.name}${have !== null ? ` (${G.formatMoney(have)})` : ''}</span>`;
}

function matsChips(mats) {
  return Object.entries(mats).map(([k, n]) => resChip(k, n, s.inv[k] || 0)).join(' ');
}

function producerStateText(b) {
  return { calisiyor: 'Çalışıyor', girdi: 'Girdi bekliyor: depoda yeterli mal yok', dolu: 'Depo dolu: malı sat ya da depoyu büyüt', baglantisiz: 'Yola bağlı değil' }[G.producerStatus(s, b)];
}

function producerBlock(b) {
  const d = BUILDINGS[b.type];
  const r = G.ratePerHour(b.type);
  const ins = Object.entries(r.inputs).map(([k, n]) => resChip(k, n)).join(' ');
  const outs = Object.entries(r.outputs).map(([k, n]) => resChip(k, n)).join(' ');
  const st = G.producerStatus(s, b);
  return `<div><h3>Üretim (saatte)</h3>
    <div class="row">${ins ? ins + ' <b>→</b> ' : ''}${outs}</div>
    <div class="meter" style="margin-top:8px"><span data-live="pmeter" data-prop="width" style="width:0;background:var(--accent)"></span></div>
    <p class="sub" style="margin:6px 0 0;color:${st === 'calisiyor' ? 'var(--good)' : 'var(--bad)'}" data-live="pstate">${producerStateText(b)}</p>
    <p class="sub" style="margin:4px 0 0">Depoda: ${[...new Set([...Object.keys(d.produce.inputs), ...Object.keys(d.produce.outputs)])].map(k => `${RESOURCES[k].icon} ${G.formatMoney(s.inv[k] || 0)}`).join(' · ')} / ${G.formatMoney(G.depoCapacity(s))}</p></div>
    <button type="button" class="btn small" data-act="depo">📦 Depo ve pazar</button>`;
}

function upgradeBlock(b) {
  const u = G.nextUpgrade(b);
  if (!u && !(b.level > 1)) return '';
  if (!u) return `<div><h3>Seviye ${b.level} ${'★'.repeat(b.level - 1)}</h3><p class="sub" style="margin:2px 0 0">En yüksek seviyede.</p></div>`;
  const cost = G.upgradeCost(s, b);
  return `<div class="upg"><h3>Yükselt: Seviye ${b.level || 1} → ${u.level}</h3>
    <p class="sub" style="margin:2px 0 6px">Görünümü değişir, ${BUILDINGS[b.type].cat === 'konut' ? 'kirası' : 'geliri'} ×${u.mult} olur.</p>
    <div class="row"><span class="chip coin">${G.formatMoney(cost)} 🪙</span> ${matsChips(u.mats)}</div>
    <button type="button" class="btn primary" data-act="upgrade" style="margin-top:8px">Yükselt</button></div>`;
}

function doUpgrade(id) {
  const b = s.buildings[id];
  const r = G.upgrade(s, id);
  if (!r.ok && r.missing) { openMissing(G.nextUpgrade(b).mats, () => { doUpgrade(id); }, () => openBuilding(id)); return; }
  if (result(r, `Seviye ${r.level}! Bina büyüdü.`)) { A.play('levelUp'); save(); panel && (panel.sigValue = ''); }
}

// Eksik malzeme penceresi: pazardan alıp işi bitirir
function openMissing(mats, onDone, onCancel = null) {
  const miss = G.missingMats(s, mats);
  const cost = G.missingCost(s, mats);
  showModal(`<h2 style="margin:0">Eksik malzeme</h2>
    <p>Bu iş için depoda şu mallar eksik:</p>
    <div class="row">${Object.entries(miss).map(([k, n]) => resChip(k, n)).join(' ')}</div>
    <p class="sub" style="margin:0">Kendin üretebilirsin (İnşa et → Hammadde / Sanayi Üretimi) ya da şimdi pazardan alabilirsin.</p>
    <button type="button" class="btn coin" data-act="buy" ${s.money < cost ? 'disabled' : ''}>Pazardan al · ${G.formatMoney(cost)} 🪙</button>
    <button type="button" class="btn ghost" data-act="cancel">Vazgeç</button>`, {
    buy: () => { if (result(G.buyMissing(s, mats))) { A.play('coin'); onDone(); } },
    cancel: () => { if (onCancel) onCancel(); },
  });
}

// Depo ve mal pazarı
function openDepo() {
  view.selectedId = null;
  openSheet({
    sig: () => `${s.depoLevel}|${Math.floor(s.money / 50)}|${Object.values(s.inv).join()}|${Object.keys(RESOURCES).map(k => G.goodsSellPrice(s, k).toFixed(1)).join()}`,
    render: () => {
      const cap = G.depoCapacity(s);
      let html = `<h2>📦 Depo ve pazar</h2>
        <p class="sub">Her maldan en çok ${G.formatMoney(cap)} adet tutar. Çok satınca fiyat düşer, zamanla toparlanır. Alış satıştan %${Math.round((INDUSTRY.buySpread - 1) * 100)} pahalı.</p>
        <div class="row"><span class="grow sub" style="margin:0">Depo seviyesi ${s.depoLevel + 1}</span>
        <button type="button" class="btn small" data-act="depoUp" ${s.money < G.depoUpgradeCost(s) ? 'disabled' : ''}>Büyüt (×2) · ${G.formatMoney(G.depoUpgradeCost(s))} 🪙</button></div>
        <div class="goods">`;
      for (const tier of [0, 1, 2]) {
        html += `<h3>${['Hammaddeler', 'İşlenmiş mallar', 'Son ürünler'][tier]}</h3>`;
        for (const [k, r] of Object.entries(RESOURCES).filter(([, r]) => r.tier === tier)) {
          const have = s.inv[k] || 0;
          const f = G.goodsFactor(s, k);
          const trend = f < 0.97 ? `<span class="chip bad">▼ %${Math.round((1 - f) * 100)}</span>` : f > 1.03 ? `<span class="chip good">▲ %${Math.round((f - 1) * 100)}</span>` : '';
          html += `<div class="good">
            <span class="gi">${r.icon}</span>
            <div class="grow"><b>${r.name}</b> <span class="sub" style="margin:0">${G.formatMoney(have)}/${G.formatMoney(cap)}</span>
              <div class="sub" style="margin:0">Satış ${G.goodsSellPrice(s, k).toFixed(1)} · Alış ${G.goodsBuyPrice(s, k).toFixed(1)} ${trend}</div></div>
            <div class="gb"><button type="button" class="btn small" data-act="sell" data-r="${k}" data-n="10" ${have < 1 ? 'disabled' : ''}>Sat 10</button>
            <button type="button" class="btn small coin" data-act="sell" data-r="${k}" data-n="all" ${have < 1 ? 'disabled' : ''}>Hepsi</button>
            <button type="button" class="btn small" data-act="buy" data-r="${k}">Al 10</button></div></div>`;
        }
      }
      return html + '</div>';
    },
    actions: {
      depoUp: () => { if (result(G.upgradeDepo(s), `Depo büyüdü: her maldan ${G.depoCapacity(s)} adet.`)) save(); },
      sell: ds => {
        const n = ds.n === 'all' ? s.inv[ds.r] : Math.min(10, s.inv[ds.r]);
        const r = G.sellGoods(s, ds.r, n);
        if (result(r, `${r.qty} ${RESOURCES[ds.r].name} satıldı: +${G.formatMoney(r.total)} 🪙`)) { A.play('coin'); save(); }
      },
      buy: ds => {
        const r = G.buyGoods(s, ds.r, 10);
        if (result(r, `10 ${RESOURCES[ds.r].name} alındı: -${G.formatMoney(r.total)} 🪙`)) save();
      },
    },
  });
}

// Kiracının özel isteği
function storyCard(h) {
  const st = G.storyOf(s, h);
  if (!st) return '';
  const met = G.storyMet(s, h);
  const r = st.request;
  let req;
  if (r.kind === 'pay') req = `${G.formatMoney(r.amount)} 🪙 destek`;
  else if (r.kind === 'near') req = `Yakınında: ${r.types.map(t => BUILDINGS[t].name).join(' ya da ')}`;
  else req = `Konum bonusu en az %${r.min} (şu an %${G.bonusAt(s, h.x, h.y).total})`;
  const rw = st.reward;
  const reward = [rw.unlock ? `nadir süsleme: <b>${BUILDINGS[rw.unlock].name}</b>${s.rareUnlocked.includes(rw.unlock) ? ' (zaten açık)' : ''}` : '',
    rw.diamonds ? `${rw.diamonds} elmas` : '', rw.money ? `${G.formatMoney(rw.money)} 🪙` : ''].filter(Boolean).join(' + ');
  const btn = r.kind === 'pay' ? `Öde ve sevindir (${G.formatMoney(r.amount)})` : 'İsteği tamamla';
  return `<div class="story">
    <div class="row">${portrait(h.tenure.tenant, 40)}<div class="grow"><div class="story-t">📜 ${st.title}</div>
      <div class="sub" style="margin:0" data-live="storyLeft">${G.formatDuration(h.story.until - s.gameTime)} kaldı</div></div></div>
    <p>“${st.text}”</p>
    <div><span class="chip ${met ? 'good' : 'bad'}">${met ? '✓' : '✗'} ${req}</span></div>
    <p class="sub" style="margin:0">Ödül: ${reward} · kiracının memnuniyeti kalıcı +${CONFIG.storySatBonus}</p>
    <button type="button" class="btn coin" data-act="story" ${met ? '' : 'disabled'}>${btn}</button>
  </div>`;
}

// Binanın piyasa değeri: alış fiyatına göre ne kadar değerlendi
function valueLine(b) {
  const v = G.marketValue(s, b);
  const diff = Math.round((v / (b.paid || 1) - 1) * 100);
  const chip = diff > 0 ? `<span class="chip good">▲ %${diff}</span>` : diff < 0 ? `<span class="chip bad">▼ %${-diff}</span>` : '<span class="chip">±%0</span>';
  return `<dl class="kv"><dt>Piyasa değeri</dt><dd>${G.formatMoney(v)} 🪙 ${chip}</dd><dt>Alış</dt><dd>${G.formatMoney(b.paid || 0)} 🪙</dd></dl>`;
}

// Satış butonu iki dokunuşla onaylanır (tarayıcı onay penceresi kullanılmaz)
function sellButton(b) {
  const refund = G.sellValue(s, b);
  return `<button type="button" class="btn danger" data-act="sell">Sat (+${G.formatMoney(refund)})</button>`;
}

function sellAction(id) {
  return (ds, el) => {
    if (el.dataset.armed !== '1') {
      el.dataset.armed = '1';
      el.textContent = 'Emin misin? Dokun: sat';
      setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Sat'; } }, 3000);
      return;
    }
    const r = G.sell(s, id);
    if (result(r, `Satıldı: +${G.formatMoney(r.refund + (r.collected || 0))} 🪙`)) { deselect(); save(); }
  };
}

// ---------- Bina kartı ----------

function openBuilding(id, skipVisitor = false) {
  const b = s.buildings[id];
  if (!b) return;
  const vis = G.visitorHere(s);
  if (!skipVisitor && vis && vis.id === id) return openVisitor();
  view.selectedId = id;
  const d = BUILDINGS[b.type];
  if (d.cat === 'konut') return openHouse(id);

  openSheet({
    valid: () => !!s.buildings[id],
    sig: () => `${G.isConnected(s, b)}|${b.x},${b.y}|${G.isCollectable(s, b)}|${b.level}|${Math.floor(s.money / 100)}|${G.isProducer(b) ? G.producerStatus(s, b) : ''}`,
    render: () => {
      const conn = G.isConnected(s, b);
      const cat = CATEGORIES[d.cat];
      let html = `<h2>${d.icon} ${d.name}</h2><p class="sub">${cat.name} · ${cat.hint}</p>`;
      if (!conn) html += `<p class="chip bad">⚠️ Yola bağlı değil. Gelir üretmez.</p>`;
      if (d.effect) html += `<div><h3>Etki alanı</h3><p style="margin:2px 0 0">${effectText(b.type)}</p></div>`;
      if (G.isProducer(b)) html += producerBlock(b);
      if (G.hasIncome(b)) {
        const cap = G.storageCap(b);
        html += `<div><h3>Gelir</h3>
          <dl class="kv"><dt>Saatte</dt><dd>${G.formatMoney(G.incomeOf(b))} 🪙</dd>
          <dt>Biriken</dt><dd><span data-live="stored"></span> / ${G.formatMoney(cap)}</dd></dl>
          <div class="meter" style="margin-top:6px"><span data-live="meter" data-prop="width" style="background:var(--coin);width:0"></span></div></div>
          <button type="button" class="btn coin" data-act="collect">Topla</button>`;
      }
      html += upgradeBlock(b);
      html += valueLine(b);
      html += `<div class="btns"><button type="button" class="btn" data-act="move">Taşı (bedava)</button>${sellButton(b)}</div>`;
      return html;
    },
    live: () => ({
      ...(G.hasIncome(b) ? {
        stored: G.formatMoney(Math.floor(b.stored || 0)),
        meter: `${Math.min(100, (b.stored || 0) / G.storageCap(b) * 100)}%`,
      } : {}),
      ...(G.isProducer(b) ? { pmeter: `${Math.min(100, (b.prog || 0) / G.cycleMs(b) * 100)}%`, pstate: producerStateText(b) } : {}),
    }),
    actions: {
      upgrade: () => doUpgrade(id),
      depo: () => openDepo(),
      collect: () => result(G.collectIncome(s, id)),
      move: () => startPlacement(b.type, id),
      sell: sellAction(id),
    },
  });
  panelTick();
}

function openHouse(id) {
  const h = s.buildings[id];
  const d = BUILDINGS[h.type];

  openSheet({
    valid: () => !!s.buildings[id],
    sig: () => {
      const st = G.houseStatus(s, h);
      const met = h.contract ? G.demandMet(s, h, h.contract.demand) : '';
      return `${st}|${h.level}|${h.x},${h.y}|${s.version}|${met}|${Math.floor(s.money / 50)}|${s.level}|${s.diamonds}|${h.contract ? G.rushCost(s, h) : ''}|${h.story?.id}|${G.storyMet(s, h)}`;
    },
    render: () => {
      const st = G.houseStatus(s, h);
      const general = G.bonusAt(s, h.x, h.y).total;
      let html = `<h2>${d.icon} ${d.name}</h2><p class="sub">Konut · konum bonusu ${pct(general)} (herkese)</p>`;

      if (st === 'baglantisiz') {
        html += `<p class="chip bad">⚠️ Yola bağlı değil</p>
          <p style="margin:0">Bu ev kiracı alamaz. Alt menüden <b>Yol</b>'a dokun ve evi ana caddeye bağla.</p>`;
        if (h.contract) html += `<p class="sub" style="margin:0">Mevcut kiracının kirası yol bağlanınca toplanabilir.</p>`;
      } else if (st === 'bos') {
        if (!h.cards) G.generateCards(s, h);
        html += `<h3>Kiracı seç</h3><div class="cards">${h.cards.map((c, i) => cardHtml(h, c, i)).join('')}</div>`;
      } else if (st === 'yenileme') {
        const r = h.renewal;
        html += `<h3>Kiracın kalmak istiyor</h3><div class="cards">${cardHtml(h, r, 'renew')}</div>
          <button type="button" class="btn ghost" data-act="decline">Başka kiracı ara</button>`;
      } else if (st === 'kirada' || st === 'hazir') {
        const c = h.contract;
        const t = TENANTS[c.tenant];
        const met = G.demandMet(s, h, c.demand);
        html += `<div class="row">${portrait(c.tenant, 52)}<div class="grow">
            <div style="font-weight:800;font-size:16px">${t.name}</div>
            <div class="sub" style="margin:0">${G.formatMinutes(c.minutes)} kontrat</div></div>
            ${st === 'hazir' ? '<span class="chip coin">Kira hazır</span>' : `<span class="chip" data-live="left"></span>`}</div>
          <div>${demandChip(met, c.demand)}</div>
          <div><div class="row" style="justify-content:space-between;font-size:13px;font-weight:700"><span>Memnuniyet</span><span data-live="sat"></span></div>
          <div class="meter"><span data-live="satbar" data-prop="width" style="width:0;background:${satColor(G.satisfaction(s, h))}"></span></div></div>
          <dl class="kv"><dt>Kira</dt><dd>${G.formatMoney(G.payoutFor(s, h))} 🪙${met ? ' <span class="chip good">+%15 memnun</span>' : ''}</dd>
          <dt>XP</dt><dd>${c.xp}</dd></dl>`;
        if (st === 'kirada') {
          html += `<button type="button" class="btn small" data-act="rush" ${s.diamonds < G.rushCost(s, h) ? 'disabled' : ''}>Hemen bitir · <span data-live="rush">${G.rushCost(s, h)}</span> elmas</button>`;
        }
        if (st === 'hazir') {
          html += `<button type="button" class="btn coin" data-act="collect">Kirayı topla</button>
            <p class="sub" style="margin:0">Toplanmayan her saat memnuniyet ${CONFIG.satLatePerHour} puan düşer. Kira kaybolmaz.</p>`;
        }
      }
      html += storyCard(h);
      html += upgradeBlock(h);
      html += valueLine(h);
      html += `<div class="btns"><button type="button" class="btn" data-act="move">Taşı (bedava)</button>${sellButton(h)}</div>`;
      return html;
    },
    live: () => {
      if (!h.contract) return h.story ? { storyLeft: `${G.formatDuration(h.story.until - s.gameTime)} kaldı` } : {};
      const sat = G.satisfaction(s, h);
      return {
        left: `${G.formatDuration(h.contract.end - s.gameTime)} kaldı`,
        sat: String(sat),
        satbar: `${sat}%`,
        rush: String(G.rushCost(s, h)),
        storyLeft: h.story ? `${G.formatDuration(h.story.until - s.gameTime)} kaldı` : '',
      };
    },
    actions: {
      sign: ds => {
        const idx = ds.i === 'renew' ? 'renew' : Number(ds.i);
        if (result(G.signContract(s, id, idx), 'Kontrat imzalandı.')) { buzz(15); save(); }
      },
      decline: () => { G.declineRenewal(s, id); G.generateCards(s, h); panel.sigValue = ''; },
      collect: () => result(G.collectRent(s, id)),
      rush: () => { if (result(G.rushContract(s, id), 'Kontrat bitti, kira hazır.')) save(); },
      upgrade: () => doUpgrade(id),
      story: () => { if (result(G.completeStory(s, id))) { panel.sigValue = ''; save(); } },
      move: () => startPlacement(h.type, id),
      sell: sellAction(id),
    },
  });
  panelTick();
}

function cardHtml(h, card, i) {
  const t = TENANTS[card.tenant];
  const q = G.quoteCard(s, h, card, i === 'renew' && card.waiveFee);
  const perHour = Math.round(q.rent / (card.minutes / 60));
  const verb = i === 'renew' ? 'Yenile' : 'İmzala';
  const fee = q.fee ? `${verb} · ücret ${G.formatMoney(q.fee)}` : `${verb} · ücretsiz`;
  return `<div class="card">
    <div class="face">${portrait(card.tenant, 46)}</div>
    <div class="t"><span>${t.name}</span><span class="dur">⏱ ${G.formatMinutes(card.minutes)}</span></div>
    <div class="nums"><span class="chip coin">${G.formatMoney(q.rent)} 🪙</span><span class="chip">saatte ${G.formatMoney(perHour)}</span>
      <span class="chip ${q.bonus.total > 0 ? 'good' : q.bonus.total < 0 ? 'bad' : ''}">konum ${pct(q.bonus.total)}</span><span class="chip">${q.xp} XP</span></div>
    <div class="wish">İster: ${demandChip(q.met, card.demand)}${q.met ? ' <span style="font-size:12px">→ +%15 kira</span>' : ''}</div>
    <button type="button" class="btn ${i === 'renew' ? 'coin' : 'primary'} small" data-act="sign" data-i="${i}" ${s.money < q.fee ? 'disabled' : ''}>${fee}</button>
  </div>`;
}

function openRoad(id) {
  view.selectedId = null;
  openSheet({
    valid: () => !!s.buildings[id],
    render: () => {
      const b = s.buildings[id];
      const ok = G.isRoadConnected(s, b.x, b.y);
      return `<h2>${BUILDINGS[b.type].icon} ${BUILDINGS[b.type].name}${G.terrainAt(b.x, b.y) === 'nehir' ? ' (köprü)' : ''}</h2><p class="sub">${ok ? 'Ana caddeye bağlı.' : 'Ana caddeye bağlı değil: kırmızı yollar işe yaramaz.'}</p>
        <button type="button" class="btn danger" data-act="remove">Yolu kaldır</button>`;
    },
    actions: { remove: () => { G.sell(s, id); deselect(); save(); } },
  });
}

// ---------- İnşa listesi ----------

function openBuild() {
  view.selectedId = null;
  openSheet({
    sig: () => `${s.level}|${Math.floor(s.money / 25)}|${s.version}|${G.season()}`,
    render: () => {
      let html = `<h2>İnşa et · ${G.activeHood(s).name}</h2><p class="sub">Fiyatlar mahalle endeksine göre: %${Math.round(G.marketIndex(s))}. Endeks düşükken inşa et, yükselince değerlensin.</p>`;
      for (const [cat, info] of Object.entries(CATEGORIES)) {
        const items = Object.entries(BUILDINGS).filter(([, d]) => d.cat === cat);
        if (!items.length) continue;
        html += `<div class="cat-title"><h3>${info.name}</h3><small>${info.hint}</small></div><div class="blist">`;
        for (const [type, d] of items) {
          const rareLocked = d.rare && !s.rareUnlocked.includes(type);
          const seasonLocked = d.season && d.season !== G.season();
          const locked = d.unlock > s.level || rareLocked || seasonLocked;
          const cost = G.buildCost(s, type);
          const poor = cost > s.money;
          const prodText = d.produce ? (() => {
            const p = d.produce;
            const ins = Object.entries(p.inputs).map(([k, n]) => `${n} ${RESOURCES[k].icon}`).join(' + ');
            const outs = Object.entries(p.outputs).map(([k, n]) => `${n} ${RESOURCES[k].icon} ${RESOURCES[k].name}`).join(', ');
            return `${p.minutes} dk: ${ins ? ins + ' → ' : ''}${outs}`;
          })() : '';
          const matsText = Object.keys(G.matsFor(type)).length ? 'Malzeme: ' + Object.entries(G.matsFor(type)).map(([k, n]) => `${n} ${RESOURCES[k].icon}`).join(' ') : '';
          const near = d.needsNear ? 'Yalnız deniz kenarına (Sahil)' : '';
          const hoodB = d.hoodBonus ? Object.entries(d.hoodBonus).map(([h, v]) => `${HOODS[h].short || HOODS[h].name}'da +%${v}`).join(', ') : '';
          const detail = d.cat === 'konut'
            ? [`Saatte ~${G.formatMoney(d.rentPerHour)} kira (kiracıya göre)`, hoodB, d.resist ? 'Kirlilikten az etkilenir' : '', near, matsText].filter(Boolean).join(' · ')
            : [prodText, d.incomePerHour ? `Saatte ${d.incomePerHour} gelir` : '', d.cleanse ? `Çevresindeki olumsuz etkiyi %${d.cleanse.factor * 100} azaltır` : '', near, matsText, effectText(type)].filter(Boolean).join(' · ');
          html += `<button type="button" class="bitem ${locked ? 'locked' : ''} ${poor ? 'poor' : ''}" data-act="pick" data-type="${type}">
            <span class="bi">${d.icon}<img src="img/binalar/${type}.png" alt="" onerror="this.remove()"></span><span class="bn">${d.name}</span>
            <span class="bc">${seasonLocked ? `${SEASONS[d.season].icon} Yalnız ${SEASONS[d.season].name.toLocaleLowerCase('tr')}` : rareLocked ? '📜 Hikayeyle açılır' : locked ? `🔒 Seviye ${d.unlock}` : d.diamondCost ? `💎 ${d.diamondCost} elmas` : `${G.formatMoney(cost)} 🪙`}</span>
            <span class="be">${detail}</span></button>`;
        }
        html += '</div>';
      }
      return html;
    },
    actions: {
      pick: ds => {
        const d = BUILDINGS[ds.type];
        if (d.rare && !s.rareUnlocked.includes(ds.type)) return toast(`${d.name} nadir bir süsleme: memnun bir kiracının isteğini yerine getirince açılır.`, true);
        if (d.unlock > s.level) return toast(`${d.name} seviye ${d.unlock}'te açılır.`, true);
        if (d.season && d.season !== G.season()) return toast(`${d.name} yalnız ${SEASONS[d.season].name.toLocaleLowerCase('tr')} mevsiminde kurulur.`, true);
        if (G.buildCost(s, ds.type) > s.money) return toast('Yeterli para yok.', true);
        if (d.diamondCost && s.diamonds < d.diamondCost) return toast(`${d.name} için ${d.diamondCost} elmas gerekli.`, true);
        startPlacement(ds.type);
      },
    },
  });
}

// ---------- Arsa ----------

function openParcel(px, py) {
  view.selectedId = null;
  const hoodId = G.hoodOfParcel(px, py);
  if (!hoodId) return;
  if (!G.hoodUnlocked(s, hoodId)) { openHoods(hoodId); return; }
  if (!G.parcelBuyable(s, px, py)) { toast('Bu mahallede bu arsa satılık değil.', true); return; }
  openSheet({
    sig: () => `${Math.floor(s.money / 10)}|${s.parcels.length}`,
    render: () => {
      const cost = G.parcelCost(s, px, py);
      const p = CONFIG.parcelSize;
      return `<h2>🔒 Kapalı arsa · ${HOODS[hoodId].name}</h2><p class="sub">${p}×${p} kare yeni yer. Bu mahallede her parsel bir öncekinden pahalı.</p>
        <div class="big-num">${G.formatMoney(cost)} 🪙</div>
        <button type="button" class="btn coin" data-act="buy" ${s.money < cost ? 'disabled' : ''}>Arsayı aç</button>`;
    },
    actions: {
      buy: () => {
        if (result(G.buyParcel(s, px, py), 'Yeni arsa açıldı!')) { closeSheet(); save(); }
      },
    },
  });
}

// ---------- Günlük hedefler ----------

function openDaily() {
  view.selectedId = null;
  openSheet({
    sig: () => JSON.stringify(s.daily) + JSON.stringify(s.weekly) + s.daily.goals.map(g => G.dailyProgress(s, g)).join() + s.weekly.goals.map(g => G.weeklyProgress(s, g)).join(),
    render: () => {
      const d = s.daily;
      let html = `<h2>🎯 Günlük hedefler</h2><p class="sub">Her gün 3 yeni hedef. Her biri ${CONFIG.dailyDiamonds} elmas; üçü birden +${CONFIG.dailyBonusDiamonds} elmas daha.</p><div class="daily">`;
      d.goals.forEach((g, i) => {
        const p = G.dailyProgress(s, g);
        const done = p >= g.n;
        html += `<div class="goal ${g.claimed ? 'claimed' : ''}">
          <div class="row"><b class="grow">${G.dailyText(g)}</b><span class="sub" style="margin:0">${G.formatMoney(p)}/${G.formatMoney(g.n)}</span></div>
          <div class="meter"><span style="width:${(p / g.n * 100).toFixed(1)}%;background:${done ? 'var(--good)' : 'var(--accent)'}"></span></div>
          ${g.claimed ? '<span class="chip good">✓ Alındı</span>' : `<button type="button" class="btn ${done ? 'coin' : ''} small" data-act="claim" data-i="${i}" ${done ? '' : 'disabled'}>${done ? `Al · ${CONFIG.dailyDiamonds} elmas` : 'Devam ediyor'}</button>`}
        </div>`;
      });
      html += `</div><p class="sub" style="margin:0">${d.bonusClaimed ? 'Bugünün bonusu alındı. Yarın yeni hedefler gelecek.' : 'Hedefler gece yarısı yenilenir.'}</p>`;
      const w = s.weekly;
      html += `<h2 style="margin-top:14px">📅 Haftalık hedefler</h2><p class="sub">Her pazartesi 3 büyük hedef. Her biri ${CONFIG.weeklyDiamonds} elmas; üçü birden +${CONFIG.weeklyBonusDiamonds} elmas daha.</p><div class="daily">`;
      w.goals.forEach((g, i) => {
        const p = G.weeklyProgress(s, g);
        const done = p >= g.n;
        html += `<div class="goal ${g.claimed ? 'claimed' : ''}">
          <div class="row"><b class="grow">${G.weeklyText(g)}</b><span class="sub" style="margin:0">${G.formatMoney(p)}/${G.formatMoney(g.n)}</span></div>
          <div class="meter"><span style="width:${(p / g.n * 100).toFixed(1)}%;background:${done ? 'var(--good)' : 'var(--accent)'}"></span></div>
          ${g.claimed ? '<span class="chip good">✓ Alındı</span>' : `<button type="button" class="btn ${done ? 'coin' : ''} small" data-act="claimw" data-i="${i}" ${done ? '' : 'disabled'}>${done ? `Al · ${CONFIG.weeklyDiamonds} elmas` : 'Devam ediyor'}</button>`}
        </div>`;
      });
      return html + '</div>';
    },
    actions: {
      claim: ds => {
        const r = G.claimDaily(s, Number(ds.i));
        if (result(r, r.bonus ? `Üç hedef tamam! +${r.diamonds} elmas` : `+${r.diamonds} elmas`)) { A.play('chime'); save(); }
      },
      claimw: ds => {
        const r = G.claimWeekly(s, Number(ds.i));
        if (result(r, r.bonus ? `Haftanın üç hedefi tamam! +${r.diamonds} elmas` : `+${r.diamonds} elmas`)) { A.play('chime'); save(); }
      },
    },
  });
}

// ---------- Ziyaretçi ----------

function openVisitor() {
  const v = G.visitorHere(s);
  if (!v) return;
  view.selectedId = v.id;
  openSheet({
    valid: () => !!G.visitorHere(s),
    sig: () => `${JSON.stringify(G.visitorCheck(s))}|${Math.floor((v.until - s.gameTime) / G.MIN)}`,
    render: () => {
      const c = G.visitorCheck(s);
      const rw = v.def.reward(s.level);
      const rwText = [rw.money ? `${G.formatMoney(rw.money)} 🪙` : '', rw.diamonds ? `${rw.diamonds} elmas` : '', rw.xp ? `${rw.xp} XP` : '', rw.market ? `mahalle endeksi +${rw.market} (1 gün)` : ''].filter(Boolean).join(' · ');
      const left = Math.max(0, v.until - s.gameTime);
      const status = c.few ? 'Henüz 3 kiracın yok.' : c.met ? 'İsteği karşılanıyor!' : `Şu an: ${c.have}${v.def.check === 'variety' ? '' : '%'} · istenen: ${c.need}${v.def.check === 'variety' ? '' : '%'}`;
      return `<h2>${v.def.icon} ${v.def.name}</h2>
        <div class="visitor-card"><img src="img/ui/${v.def.portrait}.png" alt=""><p style="margin:0">“${v.def.text(v.n)}”</p></div>
        <p class="chip ${c.met ? 'good' : 'bad'}">${status}</p>
        <p class="sub" style="margin:0">Ödül: ${rwText}<br>${G.formatDuration(left)} daha bekler.</p>
        <div class="btns">
          <button type="button" class="btn coin" data-act="greet" ${c.met ? '' : 'disabled'}>Karşıla, ödülü al</button>
          <button type="button" class="btn ghost" data-act="building">Binayı aç</button>
          <button type="button" class="btn danger small" data-act="send">Uğurla</button>
        </div>`;
    },
    actions: {
      greet: () => {
        const r = G.greetVisitor(s);
        if (result(r, `${v.def.name} çok memnun kaldı!`)) { AMB.burst(v.building.x, v.building.y, 600); closeSheet(); save(); }
      },
      building: () => openBuilding(v.id, true),
      send: () => { G.dismissVisitor(s); closeSheet(); save(); },
    },
  });
}

// ---------- Mevsim ----------

function openSeason() {
  view.selectedId = null;
  openSheet({
    sig: () => G.season(),
    render: () => {
      const cur = G.season();
      let html = `<h2>${SEASONS[cur].icon} Mevsim: ${SEASONS[cur].name}</h2><p class="sub">Mevsim gerçek takvimle değişir. Her mevsimin kendi kuralı ve kendi süslemesi var; mevsim süsleri yalnız kendi mevsiminde kurulur.</p><div class="season-list">`;
      for (const [id, se] of Object.entries(SEASONS)) {
        const deco = Object.entries(BUILDINGS).filter(([, d]) => d.season === id).map(([, d]) => `${d.icon} ${d.name}`).join(', ');
        html += `<div class="season-item ${id === cur ? 'on' : ''}"><span class="si">${se.icon}</span><span><b>${se.name}${id === cur ? ' · şimdi' : ''}</b>${se.text}${deco ? `<br><small>Süsleme: ${deco}</small>` : ''}</span></div>`;
      }
      return html + '</div>';
    },
    actions: {},
  });
}

// ---------- Mahalleler ----------

// focus: kapalı bir mahalleye dokunulduysa onun adı (listede vurgulanır)
function openHoods(focus = null) {
  view.selectedId = null;
  openSheet({
    sig: () => `${s.hood}|${s.hoodsOpen.join()}|${s.level}|${Math.floor(s.money / 1000)}|${s.hoodsOpen.map(id => Math.round(G.marketIndex(s, id))).join()}|${G.eventOf(s)?.id}`,
    render: () => {
      let html = '<h2>Mahalleler</h2><p class="sub">Bütün mahalleler aynı haritada yan yana. Her birinin kendi kuralı, arsa fiyatı ve emlak endeksi var. Gör\'e basınca kamera oraya gider.</p>';
      html += marketCard();
      html += '<div class="hoods">';
      for (const [id, hd] of Object.entries(HOODS)) {
        const open = G.hoodUnlocked(s, id);
        const current = s.hood === id;
        let action;
        if (current) action = '<span class="chip good">Buradasın</span>';
        else if (open) action = `<button type="button" class="btn primary small" data-act="go" data-id="${id}">Gör</button>`;
        else if (s.level < hd.unlock) action = `<span class="chip">🔒 Seviye ${hd.unlock}</span> <button type="button" class="btn small" data-act="go" data-id="${id}">Gör</button>`;
        else action = `<button type="button" class="btn coin small" data-act="open" data-id="${id}" ${s.money < hd.openCost ? 'disabled' : ''}>Aç · ${G.formatMoney(hd.openCost)}</button>`;
        const idxChip = open ? ` <span class="chip ${G.marketIndex(s, id) >= 100 ? 'good' : 'bad'}">%${Math.round(G.marketIndex(s, id))}</span>` : '';
        html += `<div class="hood ${current || focus === id ? 'current' : ''} ${open ? '' : 'locked'}">
          <span class="hi">${hd.icon}</span><span class="hn">${hd.name}${idxChip}</span>${action}
          <span class="hh">${hd.hint}</span></div>`;
      }
      return html + '</div>';
    },
    actions: {
      open: ds => { if (result(G.openHood(s, ds.id))) { goHood(ds.id); } },
      go: ds => goHood(ds.id),
    },
  });
}

// Görüntülenen mahallenin piyasa kartı: endeks, grafik, bileşenler, olay
function marketCard() {
  const idx = G.marketIndex(s);
  const target = G.marketTarget(s);
  const { parts, houses } = G.marketBreakdown(s);
  const ev = G.eventOf(s);
  const hist = [...G.marketOf(s).hist, Math.round(idx)];
  // grafik aralığı veriye göre (100 çizgisi her zaman görünür)
  const lo = Math.min(95, ...hist) - 3, hi = Math.max(105, ...hist) + 3, W = 300, Hh = 56;
  const pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1) * W).toFixed(1)},${(Hh - (v - lo) / (hi - lo) * Hh).toFixed(1)}`).join(' ');
  const y100 = (Hh - (100 - lo) / (hi - lo) * Hh).toFixed(1);
  const trend = target > idx + 0.5 ? '▲ yükseliyor' : target < idx - 0.5 ? '▼ düşüyor' : '• sabit';
  const row = (label, v) => `<dt>${label}</dt><dd style="color:${v > 0 ? 'var(--good)' : v < 0 ? 'var(--bad)' : 'inherit'}">${v > 0 ? '+' : ''}${Math.round(v)}</dd>`;
  return `<div class="market">
    <div class="row"><div class="grow"><div class="sub" style="margin:0">${G.activeHood(s).name} · emlak endeksi</div>
      <div class="big-num" style="color:var(--text)">%${Math.round(idx)}</div></div>
      <span class="chip ${target >= idx ? 'good' : 'bad'}">${trend} → %${Math.round(target)}</span></div>
    <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" class="spark" aria-label="Endeks geçmişi">
      <line x1="0" x2="${W}" y1="${y100}" y2="${y100}" class="spark-base"/>
      <polyline points="${pts}" class="spark-line"/></svg>
    ${ev ? `<div class="news ${ev.effect < 0 ? 'bad' : ''}">📰 <b>${ev.text}</b> · ${ev.effect > 0 ? '+' : ''}${ev.effect} · ${G.formatDuration(ev.until - s.gameTime)} kaldı</div>` : ''}
    <dl class="kv">${row('Memnun kiracılar', parts.happy)}${row('Boş evler', parts.vacant)}${row('Yerleşim (ortalama bonus)', parts.placement)}${row('Sanatçılar', parts.artists)}${ev ? row('Olay', ev.effect) : ''}</dl>
    <p class="sub" style="margin:0">${houses ? 'Endeks 70–140 arasında hedefe doğru yavaşça kayar. Bina ve arsa fiyatları endeksle değişir; binalar endeks yükselince değerlenir.' : 'Bu mahallede henüz ev yok. Ev kurup kiracı yerleştirdikçe endeks hareketlenir.'}</p>
  </div>`;
}

// Kamerayı mahalleye götür (hepsi aynı haritada)
function goHood(id) {
  closeSheet();
  view.selectedId = null;
  centerHood(id, Math.max(R.cam.z, startZoom()));
  G.setViewHood(s, id);
  toast(`${HOODS[id].name} ${HOODS[id].icon}`);
}

// ---------- Menü ----------

function openMenu() {
  view.selectedId = null;
  openSheet({
    sig: () => `${s.speed}|${s.testMode}|${s.seasonOverride}|${s.level}|${AMB.enabled}|${prefs.sfx}|${prefs.music}|${s.achieved.length}|${JSON.stringify(s.collection)}|${s.collectionSets}`,
    render: () => `<h2>Menü</h2>
      <div><h3>Ses</h3>
        <div class="btns"><button type="button" class="btn ${prefs.sfx ? 'coin' : ''}" data-act="sfx">Efektler: ${prefs.sfx ? 'açık' : 'kapalı'}</button>
        <button type="button" class="btn ${prefs.music ? 'coin' : ''}" data-act="music">Müzik: ${prefs.music ? 'açık' : 'kapalı'}</button></div></div>
      <div><h3>Şehirde hareket</h3>
        <div class="btns"><button type="button" class="btn ${AMB.enabled ? 'coin' : ''}" data-act="motion" data-v="1">Açık</button>
        <button type="button" class="btn ${AMB.enabled ? '' : 'coin'}" data-act="motion" data-v="0">Kapalı</button></div>
        <p class="sub" style="margin:6px 0 0">Arabalar, yürüyen insanlar, duman ve ağaçlar. Telefon yavaşlarsa kapat.</p></div>
      <div><h3>Zaman hızı (test için)</h3>
        <div class="btns">${CONFIG.speeds.map(v => `<button type="button" class="btn ${s.speed === v ? 'coin' : ''}" data-act="speed" data-v="${v}">×${v}</button>`).join('')}</div>
        <p class="sub" style="margin:6px 0 0">×60'ta 1 dakika = 1 saat. Kontratları hızlıca denemek için.</p></div>
      <div><h3>${SEASONS[G.season()].icon} Mevsim (test için)</h3>
        <div class="btns"><button type="button" class="btn ${!s.seasonOverride ? 'coin' : ''}" data-act="season" data-v="">Takvime göre</button>${Object.entries(SEASONS).map(([id, se]) => `<button type="button" class="btn ${s.seasonOverride === id ? 'coin' : ''}" data-act="season" data-v="${id}">${se.icon} ${se.name}</button>`).join('')}</div></div>
      <div><h3>🧪 Test modu</h3>
        <div class="btns"><button type="button" class="btn ${s.testMode ? 'coin' : ''}" data-act="testmode">Sınırsız para ve elmas: ${s.testMode ? 'açık' : 'kapalı'}</button></div>
        <div class="btns" style="margin-top:6px">${[10, 20, 30].map(v => `<button type="button" class="btn ${s.level >= v ? 'coin' : ''}" data-act="testlevel" data-v="${v}">Seviye ${v}</button>`).join('')}</div>
        <p class="sub" style="margin:6px 0 0">Açıkken para, elmas ve depodaki her mal hiç bitmez. Seviye 30'da bütün binalar açılır.</p></div>
      <div><h3>Nasıl oynanır</h3>${helpHtml()}</div>
      <div><h3>🏆 Başarımlar (${s.achieved.length}/${ACHIEVEMENTS.length})</h3>
        <div class="achs">${ACHIEVEMENTS.map(a => {
          const done = s.achieved.includes(a.id);
          const p = Math.min(a.n, G.achievementProgress(s, a));
          const rw = a.reward.diamonds ? `${a.reward.diamonds} elmas` : `${G.formatMoney(a.reward.money)} 🪙`;
          return `<div class="ach ${done ? 'done' : ''}"><span>${done ? '✓' : '○'}</span><span class="grow">${a.text}</span><span class="sub" style="margin:0">${done ? rw : a.kind === 'netWorth' ? rw : `${G.formatMoney(p)}/${G.formatMoney(a.n)}`}</span></div>`;
        }).join('')}</div></div>
      <div><h3>Koleksiyon</h3>
        <p class="sub" style="margin:2px 0 8px">Kira toplarken parça düşer. Her parçadan birer tane toplayınca seti tamamla: kiraya kalıcı +%${CONFIG.collectionSetBonus}.</p>
        <div class="coll">${Object.entries(COLLECTION).map(([k, it]) => `<div class="coll-item ${s.collection[k] ? '' : 'empty'}"><img src="img/ui/${it.image}.png" alt=""><span>${it.name}</span><b>${s.collection[k]}</b></div>`).join('')}</div>
        <div class="row" style="margin-top:8px"><span class="grow sub" style="margin:0">Tamamlanan set: <b>${s.collectionSets}</b> · kira bonusu +%${s.collectionSets * CONFIG.collectionSetBonus}</span>
        <button type="button" class="btn coin small" data-act="set" ${G.canCompleteSet(s) ? '' : 'disabled'}>Seti tamamla</button></div></div>
      <div><h3>Oyun</h3><button type="button" class="btn danger" data-act="reset">Baştan başla</button></div>
      <p class="sub" style="margin:0">Prototip 0.1 · ilerleme bu cihazda saklanır.</p>`,
    actions: {
      season: ds => { G.setSeasonOverride(s, ds.v || null); panel.sigValue = ''; save(); },
      testmode: () => { G.setTestMode(s, !s.testMode); toast(s.testMode ? 'Test modu açık: para ve elmas sınırsız' : 'Test modu kapalı'); panel.sigValue = ''; save(); },
      testlevel: ds => { G.testSetLevel(s, Number(ds.v)); toast(`Seviye ${ds.v}`); panel.sigValue = ''; save(); },
      speed: ds => { s.speed = Number(ds.v); toast(`Zaman hızı ×${ds.v}`); save(); },
      motion: ds => setMotion(ds.v === '1'),
      sfx: () => { prefs.sfx = !prefs.sfx; A.setSfx(prefs.sfx); savePrefs(); panel.sigValue = ''; },
      music: () => { prefs.music = !prefs.music; A.unlock(); A.setMusic(prefs.music); savePrefs(); panel.sigValue = ''; },
      set: () => { if (result(G.completeSet(s), `Set tamamlandı! Kira bonusu artık +%${s.collectionSets * CONFIG.collectionSetBonus}`)) { panel.sigValue = ''; save(); } },
      reset: (ds, el) => {
        if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Her şey silinecek. Emin misin?'; return; }
        s = G.createState();
        save();
        closeSheet();
        centerHood('eski', startZoom());
        showWelcome();
      },
    },
  });
}

function helpHtml() {
  return `<ul class="help">
    <li><b>Ev kur</b>, ana caddeye ya da bağlı bir yola komşu olsun.</li>
    <li>Boş eve dokun, <b>kiracı seç</b>. Kısa kontrat az ama sık, uzun kontrat yoğun ama nadir kazandırır.</li>
    <li>Süre dolunca 💰 çıkar. Dokun ya da parmağını binaların üstünde <b>sürükleyerek</b> topla.</li>
    <li>Geç kalırsan kira kaybolmaz ama kiracının memnuniyeti düşer.</li>
    <li>Kafe, park, okul gibi binalar çevresine <b>etki alanı</b> yayar. Atölye çok kazandırır ama çevresini kötüleştirir.</li>
    <li>Binaları istediğin an <b>bedava taşı</b>. İyi yerleşim = daha çok kira.</li>
    <li>Kilitli arsaya dokunarak yeni yer aç.</li>
    <li>Memnun kalıp kontratını yenileyen kiracı bazen <b>📜 istekte bulunur</b>. Yerine getirirsen nadir bir süsleme açılır.</li></ul>`;
}

function openLevel() {
  const next = Object.values(BUILDINGS).filter(d => d.unlock === s.level + 1);
  openSheet({
    render: () => `<h2>Seviye ${s.level}</h2>
      <p class="sub">${s.xp} / ${G.xpToNext(s.level)} XP</p>
      <p style="margin:0">XP; kira toplama, kontrat, inşaat ve görevlerden gelir.</p>
      ${next.length ? `<div><h3>Seviye ${s.level + 1}'de açılacak</h3><p style="margin:2px 0 0">${next.map(d => `${d.icon} ${d.name}`).join(', ')}</p></div>` : ''}`,
  });
}

// ---------- Pencereler ----------

function showModal(html, actions) {
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
  $('modalBody').onclick = e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    $('modal').hidden = true;
    if (fn) fn();
  };
}

function showWelcome() {
  showModal(`<div class="advisor"><img src="img/ui/danisman.png" alt="" onerror="this.remove()"><h2 style="margin:0">Eski Çarşı'ya hoş geldin</h2></div>
    <p>Küçük bir kasabada emlakçısın. Ev kur, kiracı yerleştir, kira topla ve şehri büyüt.</p>
    ${helpHtml()}
    <p class="sub" style="margin:0">Üstteki <b>Danışman</b> şeridi seni adım adım yönlendirir.</p>
    <button type="button" class="btn primary" data-act="ok">Başla</button>`, {});
}

function showAway(sum) {
  showModal(`<h2 style="margin:0">Sen yokken</h2>
    <p class="sub" style="margin:0">${G.formatDuration(sum.elapsed)} geçti (oyun zamanı)</p>
    <div class="big-num">${G.formatMoney(sum.rentWaiting + sum.income)} 🪙</div>
    <dl class="kv">
      <dt>Kirası hazır ev</dt><dd>${sum.readyHouses}</dd>
      <dt>Bekleyen kira</dt><dd>${G.formatMoney(sum.rentWaiting)}</dd>
      <dt>Ticari gelir</dt><dd>${G.formatMoney(sum.income)}</dd>
      ${sum.unhappy ? `<dt>Memnuniyeti düşen</dt><dd style="color:var(--bad)">${sum.unhappy} ev</dd>` : ''}
    </dl>
    <button type="button" class="btn coin" data-act="all">Hepsini topla</button>
    <button type="button" class="btn ghost" data-act="close">Şehre bak</button>`, {
    all: () => {
      const total = G.collectAll(s);
      if (total) toast(`+${G.formatMoney(total)} 🪙 toplandı`);
    },
  });
}

function showRareUnlocked(type) {
  const d = BUILDINGS[type];
  buzz(40);
  showModal(`<div class="rare-img"><img src="img/binalar/${type}.png" alt=""></div>
    <div class="big-num" style="color:var(--accent);text-align:center">Nadir süsleme açıldı!</div>
    <p style="text-align:center"><b>${d.icon} ${d.name}</b> artık İnşa et → Süsleme bölümünde.</p>
    <p class="sub" style="margin:0;text-align:center">${effectText(type)}</p>
    <button type="button" class="btn primary" data-act="ok">Harika</button>`, {});
}

function showLevelUp(level, reward, diamonds = 0) {
  const unlocked = Object.values(BUILDINGS).filter(d => d.unlock === level);
  buzz(40);
  showModal(`<div class="big-num" style="color:var(--accent)">Seviye ${level}!</div>
    <p>Ödül: <b>+${G.formatMoney(reward)} 🪙</b>${diamonds ? ` ve <b>+${diamonds} elmas</b>` : ''}</p>
    ${unlocked.length ? `<p>Yeni bina: ${unlocked.map(d => `${d.icon} <b>${d.name}</b>`).join(', ')}</p>` : ''}
    <button type="button" class="btn primary" data-act="ok">Devam</button>`, {});
}

// ---------- Bağlantılar ----------

function bindUi() {
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', () => R.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); A.pause(document.hidden); });
  // tarayıcı sesi ilk dokunuştan sonra açar
  const unlockAudio = () => { A.unlock(); };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  for (const b of document.querySelectorAll('.dock-btn')) b.addEventListener('click', () => A.play('tap'));
  $('seasonBtn').addEventListener('click', () => { A.play('tap'); openSeason(); });
  $('dailyBtn').addEventListener('click', () => { A.play('tap'); if (mode === 'road') setMode('normal'); openDaily(); });
  window.addEventListener('pagehide', save);

  $('sheetBody').addEventListener('click', onSheetClick);
  $('sheetClose').addEventListener('click', deselect);
  $('btnBuild').addEventListener('click', () => { if (mode === 'road') setMode('normal'); openBuild(); });
  $('btnRoad').addEventListener('click', () => { roadErase = false; setMode(mode === 'road' ? 'normal' : 'road'); });
  $('btnCollect').addEventListener('click', () => {
    const total = G.collectAll(s);
    toast(total ? `+${G.formatMoney(total)} 🪙 toplandı` : 'Şu an toplanacak bir şey yok.');
  });
  $('btnMenu').addEventListener('click', () => { if (mode === 'road') setMode('normal'); openMenu(); });
  $('btnHood').addEventListener('click', () => { if (mode === 'road') setMode('normal'); openHoods(); });
  $('btnDepo').addEventListener('click', () => { if (mode === 'road') setMode('normal'); openDepo(); });
  $('levelBtn').addEventListener('click', openLevel);
  $('placeOk').addEventListener('click', confirmPlacement);
  $('placeCancel').addEventListener('click', cancelPlacement);
  $('quest').addEventListener('click', () => {
    if (G.questComplete(s)) {
      const r = G.claimQuest(s);
      if (r.ok) { A.play('chime'); toast(`Görev tamam! +${G.formatMoney(r.reward.money)} 🪙${r.reward.xp ? ` +${r.reward.xp} XP` : ''}${r.reward.diamonds ? ` +${r.reward.diamonds} elmas` : ''}`); }
      save();
    } else {
      toast(G.currentQuest(s)?.text || '');
    }
  });
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
