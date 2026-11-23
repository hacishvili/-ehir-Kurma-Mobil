// Oyunun ekranı: döngü, dokunma, menüler. Kurallar game.js'te, rakamlar data.js'te.
import { CONFIG, BUILDINGS, TENANTS, CATEGORIES, QUESTS } from './data.js';
import * as G from './game.js';
import { createRenderer, loadSprites } from './render.js';
import { createAmbient } from './ambient.js';

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
function loadPrefs() {
  let motion = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    if (typeof p.motion === 'boolean') motion = p.motion;
  } catch (e) { /* varsayılan */ }
  AMB.enabled = motion;
}

function setMotion(on) {
  AMB.enabled = on;
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ motion: on })); } catch (e) { /* depolama kapalı */ }
}

function save() {
  try { localStorage.setItem(SAVE_KEY, G.serialize(s)); } catch (e) { /* depolama kapalı olabilir */ }
}

// ---------- Başlangıç ----------

function startZoom() {
  return Math.min(1.6, Math.max(0.8, R.size.W / (64 * 4.6)));
}

function start(hotData = {}) {
  const loaded = loadSave(hotData);
  s = loaded || G.createState();
  R.resize();
  R.centerOn(6, 6, startZoom());

  if (loaded) {
    const before = s.gameTime;
    G.advance(s, Math.max(0, Date.now() - s.savedAt));
    const sum = G.awaySummary(s, before);
    if (sum.elapsed > 60 * 1000 && (sum.readyHouses || sum.income > 0)) showAway(sum);
  } else {
    showWelcome();
  }
  s.events.length = 0;
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
    if (e.type === 'collected') {
      view.floaters.push({ x: e.x, y: e.y, text: `+${G.formatMoney(e.amount)} 🪙`, t0: t });
      AMB.burst(e.x, e.y, e.amount);
      buzz(12);
    } else if (e.type === 'levelUp') {
      showLevelUp(e.level, e.reward);
    } else if (e.type === 'tenantLeft') {
      toast('Bir kiracı memnun kalmadığı için ayrıldı. Kirası yine de toplandı.', true);
    }
  }
}

function buzz(ms) {
  try { navigator.vibrate?.(ms); } catch (e) { /* titreşim yok */ }
}

// ---------- Üst gösterge ----------

const hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).textContent = v;
}

function updateHud() {
  setText('money', G.formatMoney(s.money));
  setText('level', String(s.level));
  setText('worth', G.formatMoney(G.netWorth(s)));
  const pct = Math.min(100, (s.xp / G.xpToNext(s.level)) * 100);
  const w = `${pct.toFixed(1)}%`;
  if (hudCache.xp !== w) { hudCache.xp = w; $('xpfill').style.width = w; }

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

  if (mode === 'road') {
    gesture = { kind: 'road', sx: x, sy: y, last: null, first: true };
    paintRoad(tx, ty, true);
    gesture.last = `${tx},${ty}`;
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
    const [tx, ty] = R.screenToTile(gesture.sx, gesture.sy);
    onTap(tx, ty);
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
  if (b && b.type === 'yol') { openRoad(b.id); return; }
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
    if (b && b.type === 'yol') G.sell(s, b.id);
    return;
  }
  if (b || G.isAvenue(tx, ty)) return;
  const r = G.build(s, 'yol', tx, ty);
  if (!r.ok && isFirst) toast(r.msg, true);
}

function setMode(m) {
  mode = m;
  $('btnRoad').classList.toggle('on', m === 'road');
  $('dock').hidden = m !== 'normal';
  $('placebar').hidden = m === 'normal';
  if (m !== 'place') view.placement = null;
  if (m === 'road') { closeSheet(); view.selectedId = null; updateRoadBar(); }
}

function updateRoadBar() {
  $('placeInfo').innerHTML = `<b>Yol yap</b><span>Parmağını sürükleyerek yol çiz. Yol bedava; binalar bağlı bir yola komşu olmalı.</span>`;
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
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
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
  const cost = pl.moveId ? 0 : G.buildCost(s, pl.type);
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

// Satış butonu iki dokunuşla onaylanır (tarayıcı onay penceresi kullanılmaz)
function sellButton(b) {
  const refund = Math.round((b.paid || 0) * CONFIG.sellRefund);
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

function openBuilding(id) {
  const b = s.buildings[id];
  if (!b) return;
  view.selectedId = id;
  const d = BUILDINGS[b.type];
  if (d.cat === 'konut') return openHouse(id);

  openSheet({
    valid: () => !!s.buildings[id],
    sig: () => `${G.isConnected(s, b)}|${b.x},${b.y}|${G.isCollectable(s, b)}`,
    render: () => {
      const conn = G.isConnected(s, b);
      const cat = CATEGORIES[d.cat];
      let html = `<h2>${d.icon} ${d.name}</h2><p class="sub">${cat.name} · ${cat.hint}</p>`;
      if (!conn) html += `<p class="chip bad">⚠️ Yola bağlı değil. Gelir üretmez.</p>`;
      if (d.effect) html += `<div><h3>Etki alanı</h3><p style="margin:2px 0 0">${effectText(b.type)}</p></div>`;
      if (G.hasIncome(b)) {
        const cap = G.storageCap(b.type);
        html += `<div><h3>Gelir</h3>
          <dl class="kv"><dt>Saatte</dt><dd>${G.formatMoney(d.incomePerHour)} 🪙</dd>
          <dt>Biriken</dt><dd><span data-live="stored"></span> / ${G.formatMoney(cap)}</dd></dl>
          <div class="meter" style="margin-top:6px"><span data-live="meter" data-prop="width" style="background:var(--coin);width:0"></span></div></div>
          <button type="button" class="btn coin" data-act="collect">Topla</button>`;
      }
      html += `<div class="btns"><button type="button" class="btn" data-act="move">Taşı (bedava)</button>${sellButton(b)}</div>`;
      return html;
    },
    live: () => G.hasIncome(b) ? {
      stored: G.formatMoney(Math.floor(b.stored || 0)),
      meter: `${Math.min(100, (b.stored || 0) / G.storageCap(b.type) * 100)}%`,
    } : {},
    actions: {
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
      return `${st}|${h.x},${h.y}|${s.version}|${met}|${Math.floor(s.money / 50)}|${s.level}`;
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
        html += `<div class="row"><span style="font-size:30px">${t.icon}</span><div class="grow">
            <div style="font-weight:800;font-size:16px">${t.name}</div>
            <div class="sub" style="margin:0">${G.formatMinutes(c.minutes)} kontrat</div></div>
            ${st === 'hazir' ? '<span class="chip coin">Kira hazır</span>' : `<span class="chip" data-live="left"></span>`}</div>
          <div>${demandChip(met, c.demand)}</div>
          <div><div class="row" style="justify-content:space-between;font-size:13px;font-weight:700"><span>Memnuniyet</span><span data-live="sat"></span></div>
          <div class="meter"><span data-live="satbar" data-prop="width" style="width:0;background:${satColor(G.satisfaction(s, h))}"></span></div></div>
          <dl class="kv"><dt>Kira</dt><dd>${G.formatMoney(G.payoutFor(s, h))} 🪙${met ? ' <span class="chip good">+%15 memnun</span>' : ''}</dd>
          <dt>XP</dt><dd>${c.xp}</dd></dl>`;
        if (st === 'hazir') {
          html += `<button type="button" class="btn coin" data-act="collect">Kirayı topla</button>
            <p class="sub" style="margin:0">Toplanmayan her saat memnuniyet ${CONFIG.satLatePerHour} puan düşer. Kira kaybolmaz.</p>`;
        }
      }
      html += `<div class="btns"><button type="button" class="btn" data-act="move">Taşı (bedava)</button>${sellButton(h)}</div>`;
      return html;
    },
    live: () => {
      if (!h.contract) return {};
      const sat = G.satisfaction(s, h);
      return {
        left: `${G.formatDuration(h.contract.end - s.gameTime)} kaldı`,
        sat: String(sat),
        satbar: `${sat}%`,
      };
    },
    actions: {
      sign: ds => {
        const idx = ds.i === 'renew' ? 'renew' : Number(ds.i);
        if (result(G.signContract(s, id, idx), 'Kontrat imzalandı.')) { buzz(15); save(); }
      },
      decline: () => { G.declineRenewal(s, id); G.generateCards(s, h); panel.sigValue = ''; },
      collect: () => result(G.collectRent(s, id)),
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
    <div class="face">${t.icon}</div>
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
      return `<h2>🛣️ Yol</h2><p class="sub">${ok ? 'Ana caddeye bağlı.' : 'Ana caddeye bağlı değil: kırmızı yollar işe yaramaz.'}</p>
        <button type="button" class="btn danger" data-act="remove">Yolu kaldır</button>`;
    },
    actions: { remove: () => { G.sell(s, id); deselect(); save(); } },
  });
}

// ---------- İnşa listesi ----------

function openBuild() {
  view.selectedId = null;
  openSheet({
    sig: () => `${s.level}|${Math.floor(s.money / 25)}|${s.version}`,
    render: () => {
      let html = '<h2>İnşa et</h2>';
      for (const [cat, info] of Object.entries(CATEGORIES)) {
        const items = Object.entries(BUILDINGS).filter(([, d]) => d.cat === cat);
        html += `<div class="cat-title"><h3>${info.name}</h3><small>${info.hint}</small></div><div class="blist">`;
        for (const [type, d] of items) {
          const locked = d.unlock > s.level;
          const cost = G.buildCost(s, type);
          const poor = cost > s.money;
          const detail = d.cat === 'konut'
            ? `Saatte ~${G.formatMoney(d.rentPerHour)} kira (kiracıya göre)`
            : [d.incomePerHour ? `Saatte ${d.incomePerHour} gelir` : '', effectText(type)].filter(Boolean).join(' · ');
          html += `<button type="button" class="bitem ${locked ? 'locked' : ''} ${poor ? 'poor' : ''}" data-act="pick" data-type="${type}">
            <span class="bi">${d.icon}</span><span class="bn">${d.name}</span>
            <span class="bc">${locked ? `🔒 Seviye ${d.unlock}` : `${G.formatMoney(cost)} 🪙`}</span>
            <span class="be">${detail}</span></button>`;
        }
        html += '</div>';
      }
      return html;
    },
    actions: {
      pick: ds => {
        const d = BUILDINGS[ds.type];
        if (d.unlock > s.level) return toast(`${d.name} seviye ${d.unlock}'te açılır.`, true);
        if (G.buildCost(s, ds.type) > s.money) return toast('Yeterli para yok.', true);
        startPlacement(ds.type);
      },
    },
  });
}

// ---------- Arsa ----------

function openParcel(px, py) {
  view.selectedId = null;
  openSheet({
    sig: () => `${Math.floor(s.money / 10)}|${s.parcels.length}`,
    render: () => {
      const cost = G.parcelCost(s);
      const p = CONFIG.parcelSize;
      return `<h2>🔒 Kapalı arsa</h2><p class="sub">${p}×${p} kare yeni yer. Her parsel bir öncekinden pahalı.</p>
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

// ---------- Menü ----------

function openMenu() {
  view.selectedId = null;
  openSheet({
    sig: () => `${s.speed}|${AMB.enabled}`,
    render: () => `<h2>Menü</h2>
      <div><h3>Şehirde hareket</h3>
        <div class="btns"><button type="button" class="btn ${AMB.enabled ? 'coin' : ''}" data-act="motion" data-v="1">Açık</button>
        <button type="button" class="btn ${AMB.enabled ? '' : 'coin'}" data-act="motion" data-v="0">Kapalı</button></div>
        <p class="sub" style="margin:6px 0 0">Arabalar, yürüyen insanlar, duman ve ağaçlar. Telefon yavaşlarsa kapat.</p></div>
      <div><h3>Zaman hızı (test için)</h3>
        <div class="btns">${CONFIG.speeds.map(v => `<button type="button" class="btn ${s.speed === v ? 'coin' : ''}" data-act="speed" data-v="${v}">×${v}</button>`).join('')}</div>
        <p class="sub" style="margin:6px 0 0">×60'ta 1 dakika = 1 saat. Kontratları hızlıca denemek için.</p></div>
      <div><h3>Nasıl oynanır</h3>${helpHtml()}</div>
      <div><h3>Oyun</h3><button type="button" class="btn danger" data-act="reset">Baştan başla</button></div>
      <p class="sub" style="margin:0">Prototip 0.1 · ilerleme bu cihazda saklanır.</p>`,
    actions: {
      speed: ds => { s.speed = Number(ds.v); toast(`Zaman hızı ×${ds.v}`); save(); },
      motion: ds => setMotion(ds.v === '1'),
      reset: (ds, el) => {
        if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Her şey silinecek. Emin misin?'; return; }
        s = G.createState();
        save();
        closeSheet();
        R.centerOn(6, 6, startZoom());
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
    <li>Kilitli arsaya dokunarak yeni yer aç.</li></ul>`;
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
  showModal(`<h2 style="margin:0">Eski Çarşı'ya hoş geldin</h2>
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

function showLevelUp(level, reward) {
  const unlocked = Object.values(BUILDINGS).filter(d => d.unlock === level);
  buzz(40);
  showModal(`<div class="big-num" style="color:var(--accent)">Seviye ${level}!</div>
    <p>Ödül: <b>+${G.formatMoney(reward)} 🪙</b></p>
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
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
  $('levelBtn').addEventListener('click', openLevel);
  $('placeOk').addEventListener('click', confirmPlacement);
  $('placeCancel').addEventListener('click', cancelPlacement);
  $('quest').addEventListener('click', () => {
    if (G.questComplete(s)) {
      const r = G.claimQuest(s);
      if (r.ok) toast(`Görev tamam! +${G.formatMoney(r.reward.money)} 🪙${r.reward.xp ? ` +${r.reward.xp} XP` : ''}`);
      save();
    } else {
      toast(G.currentQuest(s)?.text || '');
    }
  });
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
