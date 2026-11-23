// Oyun mantığı. Ekran çizimi ve dokunma burada yok; böylece testler tarayıcısız çalışır.
import { CONFIG, BUILDINGS, TENANTS, QUESTS, TERRAIN, COLLECTION, HOODS, TALL, MARKET_EVENTS, STORIES, DAILY_GOALS,
  RESOURCES, MATS, UPGRADES, VARIANTS, INDUSTRY, ACHIEVEMENTS } from './data.js';

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const SAVE_VERSION = 1;

// ---------- Durum ----------

export function createState() {
  const s = {
    v: SAVE_VERSION,
    money: CONFIG.startMoney,
    xp: 0,
    level: 1,
    gameTime: 0,
    speed: 1,
    savedAt: Date.now(),
    nextId: 1,
    parcels: CONFIG.startParcels.map(([px, py]) => `${px},${py}`),
    parcelsPaid: 0,
    buildings: {},
    stats: { contractsSigned: 0, rentsCollected: 0, moneyEarned: 0 },
    questIndex: 0,
    questDone: false,
    hood: 'eski',
    hoodsOpen: ['eski'],
    hoods: {}, // açık olup şu an görüntülenmeyen mahallelerin binaları ve arsaları
    diamonds: CONFIG.startDiamonds,
    collection: Object.fromEntries(Object.keys(COLLECTION).map(k => [k, 0])),
    collectionSets: 0,
  };
  return hydrate(s);
}

// Kayıttan gelen ya da yeni durumu çalışmaya hazırlar (önbellekler kaydedilmez).
export function hydrate(s) {
  // eski kayıtlarda olmayan alanlar
  if (s.diamonds === undefined) s.diamonds = CONFIG.startDiamonds;
  if (!s.collection) s.collection = {};
  for (const k of Object.keys(COLLECTION)) s.collection[k] = s.collection[k] || 0;
  if (s.collectionSets === undefined) s.collectionSets = 0;
  if (!s.hood) { s.hood = 'eski'; s.hoodsOpen = ['eski']; s.hoods = {}; }
  if (!s.rareUnlocked) s.rareUnlocked = [];
  if (!s.stats.storiesDone) s.stats.storiesDone = 0;
  for (const k of ['built', 'incomeCollected', 'renewals', 'goodsSold']) if (!s.stats[k]) s.stats[k] = 0;
  if (!s.stats.produced) s.stats.produced = {};
  if (!s.inv) s.inv = {};
  for (const k of Object.keys(RESOURCES)) s.inv[k] = s.inv[k] || 0;
  if (s.depoLevel === undefined) s.depoLevel = 0;
  if (!s.pressure) s.pressure = {};
  if (!s.achieved) s.achieved = [];
  if (!s.market) s.market = { nextEventAt: s.gameTime + CONFIG.market.eventEveryHours * HOUR / 2, nextHistAt: s.gameTime, hoods: {} };
  for (const id of s.hoodsOpen) ensureMarket(s, id);
  setActiveHood(s.hood);
  Object.defineProperty(s, '_cache', { value: { version: -1 }, writable: true, enumerable: false });
  Object.defineProperty(s, 'events', { value: [], writable: true, enumerable: false });
  Object.defineProperty(s, 'version', { value: 0, writable: true, enumerable: false });
  return s;
}

export function serialize(s) {
  s.savedAt = Date.now();
  return JSON.stringify(s);
}

export function deserialize(json) {
  const s = JSON.parse(json);
  if (!s || s.v !== SAVE_VERSION) return null;
  return hydrate(s);
}

function emit(s, type, data = {}) {
  s.events.push({ type, ...data });
}

function changed(s) {
  s.version++;
}

// ---------- Harita ----------

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < CONFIG.gridSize && y < CONFIG.gridSize;
}

export function parcelOf(x, y) {
  return [Math.floor(x / CONFIG.parcelSize), Math.floor(y / CONFIG.parcelSize)];
}

export function isUnlocked(s, x, y) {
  const [px, py] = parcelOf(x, y);
  return s.parcels.includes(`${px},${py}`);
}

// ---------- Mahalle ----------
// Görüntülenen mahallenin tanımı. Oyunda tek durum olduğu için modül düzeyinde tutulur.
let H = HOODS.eski;
let terrainMap = new Map();

function setActiveHood(id) {
  H = HOODS[id];
  terrainMap = new Map(H.terrain.map(([x, y, type]) => [`${x},${y}`, type]));
}

export function activeHood() {
  return H;
}

// Karedeki arazi türü (nehir, tepe, deniz ...) ya da null
export function terrainAt(x, y) {
  if (!inBounds(x, y)) return null;
  return terrainMap.get(`${x},${y}`) || (H.allTerrain && !isAvenue(x, y) ? H.allTerrain : null);
}

export function isAvenue(x, y) {
  return x === H.avenue.x && y >= H.avenue.y0 && y <= H.avenue.y1 && inBounds(x, y);
}

export function hoodUnlocked(s, id) {
  return s.hoodsOpen.includes(id);
}

export function openHood(s, id) {
  const hd = HOODS[id];
  if (!hd) return fail('Bilinmeyen mahalle.');
  if (hoodUnlocked(s, id)) return fail('Bu mahalle zaten açık.');
  if (s.level < hd.unlock) return fail(`${hd.name} seviye ${hd.unlock}'te açılır.`);
  if (s.money < hd.openCost) return fail('Yeterli para yok.');
  s.money -= hd.openCost;
  s.hoodsOpen.push(id);
  ensureMarket(s, id);
  s.hoods[id] = { buildings: {}, parcels: CONFIG.startParcels.map(([px, py]) => `${px},${py}`), parcelsPaid: hd.openCost, leftAt: s.gameTime };
  addXp(s, Math.round(hd.openCost / 200));
  emit(s, 'hoodOpened', { id });
  return ok();
}

// Başka mahalleye geç: görüntülenenin verisi saklanır, hedefinki yüklenir.
export function switchHood(s, id) {
  if (!hoodUnlocked(s, id)) return fail('Bu mahalle henüz açılmadı.');
  if (id === s.hood) return ok();
  s.hoods[s.hood] = { buildings: s.buildings, parcels: s.parcels, parcelsPaid: s.parcelsPaid, leftAt: s.gameTime };
  const target = s.hoods[id];
  delete s.hoods[id];
  s.buildings = target.buildings;
  s.parcels = target.parcels;
  s.parcelsPaid = target.parcelsPaid;
  s.hood = id;
  setActiveHood(id);
  changed(s);
  // yokken biriken ticari gelir (bağlantı o sürede değişmedi)
  const away = s.gameTime - (target.leftAt ?? s.gameTime);
  accrueIncome(s, away);
  produce(s, away);
  return ok();
}

function cache(s) {
  const c = s._cache;
  if (c.version === s.version) return c;
  const n = CONFIG.gridSize;
  const grid = Array.from({ length: n }, () => new Array(n).fill(null));
  for (const b of Object.values(s.buildings)) {
    const n = sizeOf(b);
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      if (inBounds(b.x + dx, b.y + dy)) grid[b.y + dy][b.x + dx] = b;
    }
  }
  c.grid = grid;
  c.connected = computeConnected(grid);
  c.bonus = new Map();
  c.version = s.version;
  return c;
}

export function buildingAt(s, x, y) {
  if (!inBounds(x, y)) return null;
  return cache(s).grid[y][x];
}

function isRoadTile(grid, x, y) {
  if (!inBounds(x, y)) return false;
  if (isAvenue(x, y)) return true;
  const b = grid[y][x];
  return !!b && isRoadType(b.type);
}

// Ana caddeden başlayıp yollar üzerinden ulaşılabilen kareleri bulur.
function computeConnected(grid) {
  const n = CONFIG.gridSize;
  const roadOk = Array.from({ length: n }, () => new Array(n).fill(false));
  const queue = [];
  for (let y = H.avenue.y0; y <= H.avenue.y1; y++) {
    roadOk[y][H.avenue.x] = true;
    queue.push([H.avenue.x, y]);
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (isRoadTile(grid, nx, ny) && !roadOk[ny][nx]) {
        roadOk[ny][nx] = true;
        queue.push([nx, ny]);
      }
    }
  }
  return { roadOk, dirs };
}

// Bina, bağlı bir yola komşuysa bağlıdır (büyük binada herhangi bir kenarı yeter).
export function isConnected(s, b) {
  const { roadOk } = cache(s).connected;
  return footprintNeighbors(b.x, b.y, sizeOf(b)).some(([nx, ny]) => inBounds(nx, ny) && roadOk[ny][nx]);
}

// Bir bina alanının çevresindeki kareler (köşeler hariç)
export function footprintNeighbors(x, y, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push([x + i, y - 1], [x + i, y + n], [x - 1, y + i], [x + n, y + i]);
  }
  return out;
}

// Bina kaç kare kaplıyor (kenar uzunluğu): 1 ya da 2
export function sizeOf(typeOrBuilding) {
  const type = typeof typeOrBuilding === 'string' ? typeOrBuilding : typeOrBuilding.type;
  return BUILDINGS[type]?.size || 1;
}

export function isRoadConnected(s, x, y) {
  return cache(s).connected.roadOk[y]?.[x] ?? false;
}

// ---------- Etki alanı ----------

export function isRoadType(type) {
  return BUILDINGS[type]?.cat === 'yol';
}

export function def(type) {
  return BUILDINGS[type];
}

export function isHouse(b) {
  return def(b.type).cat === 'konut';
}

// (x, y) karesi, src binasının alanına radius kare uzaklıkta mı (büyük binada alanın kenarından ölçülür)
export function inRadius(src, x, y, radius) {
  const n = src.type ? sizeOf(src) : 1;
  const dx = x < src.x ? src.x - x : Math.max(0, x - (src.x + n - 1));
  const dy = y < src.y ? src.y - y : Math.max(0, y - (src.y + n - 1));
  return Math.max(dx, dy) <= radius;
}

export function covers(b, x, y) {
  const n = sizeOf(b);
  return x >= b.x && y >= b.y && x < b.x + n && y < b.y + n;
}

// (x, y) karesindeki bir evin konum bonusu (yüzde). tenant verilmezse yalnız herkese uygulanan kısım.
// extra: yerleştirme önizlemesi için geçici bina { type, x, y }; ignoreId: taşınan bina
export function bonusAt(s, x, y, tenant = null, opts = {}) {
  const { extra = null, ignoreId = null } = opts;
  const useCache = !extra && !ignoreId;
  const key = `${x},${y},${tenant || ''}`;
  const c = cache(s);
  if (useCache && c.bonus.has(key)) return c.bonus.get(key);

  const sources = Object.values(s.buildings).filter(b => b.id !== ignoreId);
  if (extra) sources.push(extra);
  const perType = {};
  for (const b of sources) {
    const e = def(b.type).effect;
    if (!e || covers(b, x, y)) continue;
    const r = e.radius + (H.rule === 'kirlilik' && e.all < 0 ? 1 : 0);
    if (!inRadius(b, x, y, r)) continue;
    const v = e.all + (tenant ? ((e.tenants || {})[tenant] || 0) : 0);
    perType[b.type] = (perType[b.type] || 0) + v;
  }
  // İş Merkezi: yüksek binalar yanındaki evin manzarasını kapatır
  if (H.rule === 'golge' && sources.some(b => TALL.includes(b.type) && !covers(b, x, y) && inRadius(b, x, y, 1))) {
    perType.golge = (perType.golge || 0) - 10;
  }
  // arazi: nehir, deniz manzarası ve tepe
  for (const [type, ter] of Object.entries(TERRAIN)) {
    if (ter.onBonus && terrainAt(x, y) === type) perType[type] = (perType[type] || 0) + ter.onBonus;
    if (ter.nearBonus && nearTerrain(x, y, type, ter.nearBonus.radius)) {
      perType[type] = (perType[type] || 0) + ter.nearBonus.all;
    }
  }
  const parts = [];
  let total = 0;
  for (const [type, raw] of Object.entries(perType)) {
    const v = clamp(raw, -CONFIG.stackCapPerType, CONFIG.stackCapPerType);
    if (v !== 0) parts.push({ type, value: v, capped: v !== raw });
    total += v;
  }
  const result = { total: clamp(total, CONFIG.bonusMin, CONFIG.bonusMax), parts };
  if (useCache) c.bonus.set(key, result);
  return result;
}

export function nearTerrain(x, y, type, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if ((dx || dy) && terrainAt(x + dx, y + dy) === type) return true;
    }
  }
  return false;
}

export function affectedByType(s, x, y, type) {
  return Object.values(s.buildings).some(b =>
    b.type === type && def(type).effect && inRadius(b, x, y, def(type).effect.radius));
}

// ---------- Kira ve kiracılar ----------

export function rentFor(houseType, tenantId, minutes, bonusPct) {
  const hours = minutes / 60;
  const perHour = def(houseType).rentPerHour * TENANTS[tenantId].rentMult *
    Math.pow(hours, CONFIG.rentDurationExponent);
  return Math.max(1, Math.round(perHour * hours * (1 + bonusPct / 100)));
}

export function xpFor(minutes) {
  return Math.max(2, Math.round(4 * Math.sqrt(minutes / 60) + 1));
}

export function demandMet(s, house, demand) {
  if (!demand) return false;
  const near = affectedByType(s, house.x, house.y, demand.type);
  return demand.kind === 'near' ? near : !near;
}

export function demandText(demand) {
  const name = def(demand.type).name.toLocaleLowerCase('tr');
  return demand.kind === 'near' ? `${name} yakınında olsun` : `${name} etkisinden uzak olsun`;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeDemand(s, tenantId, rng) {
  const t = TENANTS[tenantId];
  const likes = t.likes.filter(type => def(type).unlock <= s.level);
  const dislikes = t.dislikes.filter(type => def(type).unlock <= s.level);
  const wantAway = dislikes.length && (rng() < 0.3 || !likes.length);
  if (wantAway) return { kind: 'away', type: pick(dislikes, rng) };
  if (likes.length) return { kind: 'near', type: pick(likes, rng) };
  return null;
}

export function generateCards(s, house, rng = Math.random) {
  const ids = availableTenants(s, house.type);
  // farklı kiracı tipleri karışık sırada
  const pool = ids.slice().sort(() => rng() - 0.5);
  const cards = [];
  for (let i = 0; i < CONFIG.cardsPerHouse; i++) {
    const tenant = pool[i % pool.length];
    cards.push({
      tenant,
      minutes: pick(TENANTS[tenant].durations, rng),
      demand: makeDemand(s, tenant, rng),
    });
  }
  house.cards = cards;
  return cards;
}

// Bu ev türüne bu seviyede gelebilecek kiracılar
export function availableTenants(s, houseType) {
  return Object.entries(TENANTS)
    .filter(([, t]) => (t.unlock || 1) <= s.level && (!t.houses || t.houses.includes(houseType) || H.rule === 'tepe'))
    .map(([id]) => id);
}

// Bir kartın bu evde şu anki değeri (kira, ücret, xp, talep durumu).
export function quoteCard(s, house, card, waiveFee = false) {
  const bonus = bonusAt(s, house.x, house.y, card.tenant);
  const rent = Math.round(rentFor(house.type, card.tenant, card.minutes, bonus.total) * levelMult(house));
  return {
    rent,
    fee: waiveFee ? 0 : Math.round(rent * CONFIG.signingFeeRate),
    xp: xpFor(card.minutes),
    bonus,
    met: demandMet(s, house, card.demand),
  };
}

export function signContract(s, houseId, cardIndex) {
  const h = s.buildings[houseId];
  if (!h || !isHouse(h) || h.contract) return fail('Bu evde zaten kiracı var.');
  if (!isConnected(s, h)) return fail('Ev yola bağlı değil. Önce yanına yol yap.');
  const renewing = cardIndex === 'renew';
  const card = renewing ? h.renewal : h.cards?.[cardIndex];
  if (!card) return fail('Kiracı kartı bulunamadı.');
  const q = quoteCard(s, h, card, renewing && card.waiveFee);
  if (s.money < q.fee) return fail('İmza ücreti için yeterli para yok.');
  s.money -= q.fee;
  // aynı kiracının kaçıncı yenilemesi (hikayeler için)
  if (renewing) s.stats.renewals++;
  if (renewing && h.tenure?.tenant === card.tenant) h.tenure.renewals++;
  else { h.tenure = { tenant: card.tenant, renewals: 0 }; h.story = null; }
  h.contract = {
    tenant: card.tenant,
    minutes: card.minutes,
    demand: card.demand,
    rent: q.rent,
    xp: q.xp,
    start: s.gameTime,
    end: s.gameTime + card.minutes * MIN,
  };
  h.cards = null;
  h.renewal = null;
  s.stats.contractsSigned++;
  addXp(s, 1);
  emit(s, 'signed', { id: h.id });
  return ok();
}

export function satisfaction(s, h) {
  const c = h.contract;
  if (!c) return null;
  let v = CONFIG.satBase + (demandMet(s, h, c.demand) ? CONFIG.satDemandMet : CONFIG.satDemandMissed);
  const dislikes = TENANTS[c.tenant].dislikes;
  if (dislikes.some(type => affectedByType(s, h.x, h.y, type))) v += CONFIG.satDislikeNearby;
  if (h.storyBonus && h.tenure?.tenant === c.tenant) v += h.storyBonus;
  const lateHours = Math.max(0, s.gameTime - c.end) / HOUR;
  v -= lateHours * CONFIG.satLatePerHour;
  return clamp(Math.round(v), 0, 100);
}

export function houseStatus(s, h) {
  if (!isConnected(s, h)) return 'baglantisiz';
  if (h.contract) return s.gameTime >= h.contract.end ? 'hazir' : 'kirada';
  if (h.renewal) return 'yenileme';
  return 'bos';
}

export function payoutFor(s, h) {
  const c = h.contract;
  const bonus = demandMet(s, h, c.demand) ? CONFIG.demandMetRentBonus : 0;
  const sets = (s.collectionSets || 0) * CONFIG.collectionSetBonus / 100;
  return Math.round(c.rent * (1 + bonus) * (1 + sets));
}

export function collectRent(s, houseId, rng = Math.random) {
  const h = s.buildings[houseId];
  if (!h || !h.contract || s.gameTime < h.contract.end) return fail('Kira henüz hazır değil.');
  if (!isConnected(s, h)) return fail('Ev yola bağlı değil.');
  const c = h.contract;
  const sat = satisfaction(s, h);
  const amount = payoutFor(s, h);
  s.money += amount;
  s.stats.rentsCollected++;
  s.stats.moneyEarned += amount;
  addXp(s, c.xp);
  // koleksiyon parçası düşebilir
  if (rng() < CONFIG.collectionDropChance) {
    const keys = Object.keys(COLLECTION);
    const item = keys[Math.floor(rng() * keys.length) % keys.length];
    s.collection[item]++;
    emit(s, 'collectionDrop', { item, x: h.x, y: h.y });
  }
  h.contract = null;
  if (sat > 0) {
    h.renewal = { tenant: c.tenant, minutes: c.minutes, demand: c.demand, waiveFee: sat >= CONFIG.satHappy };
    maybeStartStory(s, h, sat, rng);
  } else {
    h.renewal = null;
    h.tenure = null;
    h.story = null;
    h.storyBonus = 0;
    emit(s, 'tenantLeft', { id: h.id, x: h.x, y: h.y });
  }
  emit(s, 'collected', { id: h.id, x: h.x, y: h.y, amount, xp: c.xp });
  return ok({ amount, left: sat <= 0 });
}

// ---------- Kiracı hikayeleri ----------

function maybeStartStory(s, h, sat, rng) {
  if (h.story || !h.tenure || h.tenure.renewals < CONFIG.storyAfterRenewals - 1) return;
  if (sat < CONFIG.satHappy || rng() >= CONFIG.storyChance) return;
  const pool = STORIES.filter(st => st.tenants.includes(h.tenure.tenant));
  if (!pool.length) return;
  // açılmamış ödülü olan hikayeler önce
  const fresh = pool.filter(st => !st.reward.unlock || !s.rareUnlocked.includes(st.reward.unlock));
  const list = fresh.length ? fresh : pool;
  const st = list[Math.floor(rng() * list.length) % list.length];
  h.story = { id: st.id, until: s.gameTime + CONFIG.storyHours * HOUR };
  emit(s, 'storyStarted', { id: h.id, x: h.x, y: h.y, title: st.title });
}

export function storyOf(s, h) {
  if (!h?.story) return null;
  return STORIES.find(st => st.id === h.story.id) || null;
}

// İstek karşılanıyor mu
export function storyMet(s, h) {
  const st = storyOf(s, h);
  if (!st) return false;
  const r = st.request;
  if (r.kind === 'pay') return s.money >= r.amount;
  if (r.kind === 'near') return r.types.some(type => affectedByType(s, h.x, h.y, type));
  if (r.kind === 'bonus') return bonusAt(s, h.x, h.y).total >= r.min;
  return false;
}

export function completeStory(s, houseId) {
  const h = s.buildings[houseId];
  const st = storyOf(s, h);
  if (!st) return fail('Bu evde bir istek yok.');
  if (s.gameTime > h.story.until) { h.story = null; return fail('İsteğin süresi doldu.'); }
  if (!storyMet(s, h)) return fail('İstek henüz karşılanmadı.');
  if (st.request.kind === 'pay') s.money -= st.request.amount;
  const rw = st.reward;
  if (rw.unlock && !s.rareUnlocked.includes(rw.unlock)) s.rareUnlocked.push(rw.unlock);
  s.money += rw.money || 0;
  s.diamonds += rw.diamonds || 0;
  h.story = null;
  h.storyBonus = CONFIG.storySatBonus;
  s.stats.storiesDone++;
  addXp(s, 30);
  emit(s, 'storyDone', { id: h.id, x: h.x, y: h.y, unlock: rw.unlock || null });
  return ok({ reward: rw });
}

// Süresi geçen hikayeler kendiliğinden kapanır (advance içinde)
function expireStories(s) {
  for (const h of Object.values(s.buildings)) {
    if (h.story && s.gameTime > h.story.until) {
      h.story = null;
      emit(s, 'storyExpired', { id: h.id });
    }
  }
}

// ---------- Günlük hedefler ----------

// Bugünün tarihi (cihazın yerel takvimi), örn. "2026-11-23"
export function todayKey(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Gün değiştiyse yeni hedefler seç (aynı gün hep aynı hedefler)
export function ensureDaily(s, today = todayKey()) {
  if (s.daily?.date === today) return s.daily;
  let h = 0;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ids = DAILY_GOALS.map(g => g.id).sort((a, b) => ((h ^ hashStr(a)) % 997) - ((h ^ hashStr(b)) % 997));
  s.daily = {
    date: today,
    bonusClaimed: false,
    goals: ids.slice(0, CONFIG.dailyCount).map(id => {
      const g = DAILY_GOALS.find(x => x.id === id);
      return { id, n: g.n(s.level), base: s.stats[g.stat] || 0, claimed: false };
    }),
  };
  emit(s, 'dailyNew', {});
  return s.daily;
}

function hashStr(str) {
  let h = 7;
  for (const ch of str) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function dailyProgress(s, goal) {
  const g = DAILY_GOALS.find(x => x.id === goal.id);
  return Math.min(goal.n, Math.max(0, (s.stats[g.stat] || 0) - goal.base));
}

export function dailyText(goal) {
  return DAILY_GOALS.find(x => x.id === goal.id).text(goal.n);
}

export function claimDaily(s, index) {
  const goal = s.daily?.goals[index];
  if (!goal || goal.claimed) return fail('Bu hedef zaten alındı.');
  if (dailyProgress(s, goal) < goal.n) return fail('Hedef henüz tamamlanmadı.');
  goal.claimed = true;
  s.diamonds += CONFIG.dailyDiamonds;
  let bonus = 0;
  if (!s.daily.bonusClaimed && s.daily.goals.every(g => g.claimed)) {
    s.daily.bonusClaimed = true;
    bonus = CONFIG.dailyBonusDiamonds;
    s.diamonds += bonus;
  }
  addXp(s, 10);
  return ok({ diamonds: CONFIG.dailyDiamonds + bonus, bonus });
}

export function dailyReadyCount(s) {
  return (s.daily?.goals || []).filter(g => !g.claimed && dailyProgress(s, g) >= g.n).length;
}

// ---------- Elmas ----------

export function rushCost(s, h) {
  if (!h?.contract) return 0;
  const hours = Math.max(0, h.contract.end - s.gameTime) / HOUR;
  return Math.max(1, Math.ceil(hours)) * CONFIG.rushDiamondsPerHour;
}

// Kontratı elmasla hemen bitir (kira hemen toplanabilir olur)
export function rushContract(s, houseId) {
  const h = s.buildings[houseId];
  if (!h?.contract || s.gameTime >= h.contract.end) return fail('Hızlandırılacak kontrat yok.');
  const cost = rushCost(s, h);
  if (s.diamonds < cost) return fail('Yeterli elmas yok.');
  s.diamonds -= cost;
  h.contract.end = s.gameTime;
  return ok({ cost });
}

// ---------- Koleksiyon ----------

export function canCompleteSet(s) {
  return s.collectionSets < CONFIG.collectionSetMax && Object.keys(COLLECTION).every(k => s.collection[k] > 0);
}

export function completeSet(s) {
  if (!canCompleteSet(s)) return fail('Set için her parçadan bir tane gerekli.');
  for (const k of Object.keys(COLLECTION)) s.collection[k]--;
  s.collectionSets++;
  addXp(s, 20);
  return ok({ sets: s.collectionSets });
}

export function declineRenewal(s, houseId) {
  const h = s.buildings[houseId];
  if (h) { h.renewal = null; h.tenure = null; h.story = null; h.storyBonus = 0; }
}

// ---------- Ticari gelir ----------

// Ticari binanın kasası en çok kaç saatlik gelir tutar (b: bina ya da tür)
export function storageCap(b) {
  return Math.round(incomeOf(b) * CONFIG.commercialStorageHours);
}

export function incomeOf(b) {
  return typeof b === 'string' ? incomePerHour(b) : Math.round(incomePerHour(b.type) * levelMult(b));
}

export function hasIncome(b) {
  return !!def(b.type).incomePerHour;
}

export function collectIncome(s, id) {
  const b = s.buildings[id];
  if (!b || !hasIncome(b)) return fail('Bu binanın geliri yok.');
  const amount = Math.floor(b.stored || 0);
  if (amount < 1) return fail('Henüz gelir birikmedi.');
  b.stored -= amount;
  s.money += amount;
  s.stats.incomeCollected++;
  s.stats.moneyEarned += amount;
  const xp = Math.max(1, Math.round(amount / 40));
  addXp(s, xp);
  emit(s, 'collected', { id, x: b.x, y: b.y, amount, xp });
  return ok({ amount });
}

// Bir binada toplanacak bir şey varsa toplar (sürükleyerek toplama için).
export function collectAny(s, id) {
  const b = s.buildings[id];
  if (!b) return fail('');
  if (isHouse(b)) return houseStatus(s, b) === 'hazir' ? collectRent(s, id) : fail('');
  if (hasIncome(b) && isConnected(s, b) && (b.stored || 0) >= 1) return collectIncome(s, id);
  return fail('');
}

export function isCollectable(s, b) {
  if (!b) return false;
  if (isHouse(b)) return houseStatus(s, b) === 'hazir';
  return hasIncome(b) && isConnected(s, b) && (b.stored || 0) >= readyThreshold(b.type);
}

export function readyThreshold(type) {
  return Math.max(1, (def(type).incomePerHour || 0) * 0.25);
}

export function collectAll(s) {
  let total = 0;
  for (const b of Object.values(s.buildings)) {
    if (isHouse(b) ? houseStatus(s, b) === 'hazir' : (hasIncome(b) && isConnected(s, b) && (b.stored || 0) >= 1)) {
      const r = collectAny(s, b.id);
      if (r.ok) total += r.amount;
    }
  }
  return total;
}

// ---------- Zaman ----------

// realMs gerçek zamanı oyun hızına göre ilerletir.
export function advance(s, realMs, rng = Math.random) {
  if (realMs <= 0) return;
  const dt = realMs * s.speed;
  s.gameTime += dt;
  accrueIncome(s, dt);
  produce(s, dt);
  goodsDecay(s, dt);
  marketTick(s, dt, rng);
  checkAchievements(s);
  expireStories(s);
}

// Görüntülenen mahallede ticari gelir biriktir (diğer mahalleler geçişte hesaplanır)
function accrueIncome(s, dt) {
  if (dt <= 0) return;
  for (const b of Object.values(s.buildings)) {
    if (hasIncome(b) && isConnected(s, b)) {
      const cap = storageCap(b);
      b.stored = Math.min(cap, (b.stored || 0) + incomeOf(b) * dt / HOUR);
    }
  }
}

// Sanayi Bölgesi'nde sanayi geliri artar
export function incomePerHour(type) {
  const d = def(type);
  const bonus = d.cat === 'sanayi' && H.industryBonus ? H.industryBonus : 0;
  return Math.round((d.incomePerHour || 0) * (1 + bonus));
}

// Oyuncu yokken olanların özeti.
export function awaySummary(s, sinceGameTime) {
  let readyHouses = 0, rentWaiting = 0, unhappy = 0, income = 0, ended = 0;
  for (const b of Object.values(s.buildings)) {
    if (isHouse(b)) {
      if (houseStatus(s, b) === 'hazir') {
        readyHouses++;
        rentWaiting += payoutFor(s, b);
        if (b.contract.end > sinceGameTime) ended++;
        if (satisfaction(s, b) < 50) unhappy++;
      }
    } else if (hasIncome(b) && isConnected(s, b)) {
      income += Math.floor(b.stored || 0);
    }
  }
  return { readyHouses, rentWaiting, unhappy, income, ended, elapsed: s.gameTime - sinceGameTime };
}

// ---------- İnşaat ----------

export function countOf(s, type) {
  return Object.values(s.buildings).filter(b => b.type === type).length;
}

export function buildCost(s, type) {
  const d = def(type);
  if (!d.cost) return 0;
  return Math.round(d.cost * Math.pow(CONFIG.buildCostGrowth, countOf(s, type)) * marketIndex(s) / 100);
}

export function canPlace(s, x, y, ignoreId = null, size = 1, type = null) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!inBounds(tx, ty)) return fail('Harita dışı.');
      if (!isUnlocked(s, tx, ty)) return fail('Bu arsa henüz açılmadı.');
      if (isAvenue(tx, ty)) return fail('Ana caddeye bina yapılamaz.');
      const ter = terrainAt(tx, ty);
      // nehrin üstüne yalnız yol yapılabilir (köprü)
      const bridge = ter === 'nehir' && type && isRoadType(type);
      if (ter && !TERRAIN[ter].buildable && !bridge) return fail(`${TERRAIN[ter].name} üstüne bina yapılamaz.${ter === 'nehir' ? ' Yol yaparsan köprü olur.' : ''}`);
      const b = buildingAt(s, tx, ty);
      if (b && b.id !== ignoreId) return fail(size > 1 ? `Bu bina ${size}×${size} kare ister; yer dolu.` : 'Bu kare dolu.');
    }
  }
  return ok();
}

export function build(s, type, x, y, rng = Math.random) {
  const d = def(type);
  if (!d) return fail('Bilinmeyen bina.');
  if (d.unlock > s.level) return fail(`Seviye ${d.unlock} gerekli.`);
  if (d.rare && !s.rareUnlocked.includes(type)) return fail('Bu nadir süsleme bir kiracı hikayesiyle açılır.');
  const p = canPlace(s, x, y, null, sizeOf(type), type);
  if (!p.ok) return p;
  const cost = buildCost(s, type);
  if (s.money < cost) return fail('Yeterli para yok.');
  if (d.diamondCost && s.diamonds < d.diamondCost) return fail(`${d.diamondCost} elmas gerekli.`);
  const mats = MATS[type] || {};
  const miss = missingMats(s, mats);
  if (Object.keys(miss).length) return fail(`Eksik malzeme: ${matsText(miss)}`, { missing: miss });
  s.money -= cost;
  if (d.diamondCost) s.diamonds -= d.diamondCost;
  takeMats(s, mats);
  const id = `b${s.nextId++}`;
  const vars = VARIANTS[type];
  const variant = vars ? vars[Math.floor(rng() * vars.length) % vars.length] : null;
  s.buildings[id] = { id, type, x, y, paid: cost + matsValue(mats), paidIndex: marketIndex(s), level: 1, variant,
    contract: null, renewal: null, cards: null, stored: 0 };
  changed(s);
  if (cost > 0) addXp(s, Math.max(1, Math.round(cost / 25)));
  if (!isRoadType(type)) s.stats.built++;
  emit(s, 'built', { id, buildingType: type });
  return ok({ id, cost });
}

export function move(s, id, x, y) {
  const b = s.buildings[id];
  if (!b) return fail('Bina bulunamadı.');
  const p = canPlace(s, x, y, id, sizeOf(b), b.type);
  if (!p.ok) return p;
  b.x = x;
  b.y = y;
  changed(s);
  return ok();
}

export function sell(s, id) {
  const b = s.buildings[id];
  if (!b) return fail('Bina bulunamadı.');
  let collected = 0;
  if (isHouse(b) && houseStatus(s, b) === 'hazir') collected = collectRent(s, id).amount || 0;
  else if (hasIncome(b) && b.stored >= 1) collected = collectIncome(s, id).amount || 0;
  const refund = sellValue(s, b);
  s.money += refund;
  delete s.buildings[id];
  changed(s);
  return ok({ refund, collected });
}

// ---------- Arsa ----------

export function parcelCost(s) {
  return Math.round(H.parcelBaseCost * Math.pow(CONFIG.parcelGrowth, s.parcels.length - CONFIG.startParcels.length) * marketIndex(s) / 100);
}

// Bu mahallede açılabilir mi (Tepe Villaları'nda arsa az)
export function parcelBuyable(px, py) {
  return !H.buyable || H.buyable.includes(`${px},${py}`);
}

export function buyParcel(s, px, py) {
  const key = `${px},${py}`;
  const max = CONFIG.gridSize / CONFIG.parcelSize;
  if (px < 0 || py < 0 || px >= max || py >= max) return fail('Geçersiz parsel.');
  if (s.parcels.includes(key)) return fail('Bu parsel zaten açık.');
  if (!parcelBuyable(px, py)) return fail('Bu mahallede bu arsa satılık değil.');
  const cost = parcelCost(s);
  if (s.money < cost) return fail('Yeterli para yok.');
  s.money -= cost;
  s.parcelsPaid += cost;
  s.parcels.push(key);
  changed(s);
  addXp(s, Math.round(cost / 30));
  emit(s, 'parcel', { key });
  return ok({ cost });
}

// ---------- Sanayileşme: depo, üretim, mal pazarı (Sanayi Baronu'ndan) ----------

export function depoCapacity(s) {
  return INDUSTRY.depoBase * Math.pow(INDUSTRY.depoGrowth, s.depoLevel || 0);
}

export function depoUpgradeCost(s) {
  return Math.round(INDUSTRY.depoCostBase * Math.pow(INDUSTRY.depoCostGrowth, s.depoLevel || 0));
}

export function upgradeDepo(s) {
  const cost = depoUpgradeCost(s);
  if (s.money < cost) return fail('Yeterli para yok.');
  s.money -= cost;
  s.depoLevel++;
  return ok({ capacity: depoCapacity(s) });
}

export function freeSpace(s, res) {
  return Math.max(0, depoCapacity(s) - (s.inv[res] || 0));
}

export function isProducer(b) {
  return !!def(b.type).produce;
}

// Döngü süresi (oyun ms); Sanayi Bölgesi'nde %25 hızlı
export function cycleMs(type) {
  const p = def(type).produce;
  return p.minutes * MIN / (1 + (H.industryBonus || 0));
}

// Üretim: her bina döngü süresi doldukça girdileri depodan alır, çıktıyı depoya koyar.
// Önce hammadde, sonra işleme (veri sırasıyla), böylece zincir aynı adımda akar.
function produce(s, dt) {
  if (dt <= 0) return;
  dt = Math.min(dt, INDUSTRY.maxOfflineHours * HOUR);
  const list = Object.values(s.buildings).filter(isProducer).sort((a, b) => tierOf(a) - tierOf(b));
  for (const b of list) {
    if (!isConnected(s, b)) { b.pstate = 'baglantisiz'; continue; }
    const p = def(b.type).produce;
    const cyc = cycleMs(b.type);
    b.prog = (b.prog || 0) + dt;
    let guard = 0;
    while (b.prog >= cyc && guard++ < 2000) {
      const lacks = Object.entries(p.inputs).some(([k, n]) => (s.inv[k] || 0) < n);
      if (lacks) { b.pstate = 'girdi'; b.prog = cyc; break; }
      const full = Object.entries(p.outputs).some(([k, n]) => freeSpace(s, k) < n);
      if (full) { b.pstate = 'dolu'; b.prog = cyc; break; }
      for (const [k, n] of Object.entries(p.inputs)) s.inv[k] -= n;
      for (const [k, n] of Object.entries(p.outputs)) {
        s.inv[k] += n;
        s.stats.produced[k] = (s.stats.produced[k] || 0) + n;
      }
      b.prog -= cyc;
      b.pstate = 'calisiyor';
    }
  }
}

function tierOf(b) {
  return def(b.type).cat === 'hammadde' ? 0 : 1;
}

export function producerStatus(s, b) {
  if (!isConnected(s, b)) return 'baglantisiz';
  return b.pstate || 'calisiyor';
}

// Saatte üretim (bu bina)
export function ratePerHour(type) {
  const p = def(type).produce;
  const perHour = HOUR / cycleMs(type);
  return { inputs: mapVals(p.inputs, n => n * perHour), outputs: mapVals(p.outputs, n => n * perHour) };
}

function mapVals(o, f) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
}

// Mal pazarı: satış fiyatı arttıkça düşer, zamanla taban fiyata döner
function priceFactor(s, res) {
  const f = Math.exp(-INDUSTRY.sensitivity * (s.pressure[res] || 0));
  return clamp(f, INDUSTRY.minFactor, INDUSTRY.maxFactor);
}

export function goodsSellPrice(s, res) {
  return RESOURCES[res].price * priceFactor(s, res);
}

export function goodsBuyPrice(s, res) {
  return goodsSellPrice(s, res) * INDUSTRY.buySpread;
}

export function goodsFactor(s, res) {
  return priceFactor(s, res);
}

// qty adetlik işlemin toplam tutarı (fiyat işlem boyunca kayar)
export function goodsQuote(s, res, qty, side) {
  const base = RESOURCES[res].price;
  const delta = base * qty * (side === 'sell' ? 1 : -1);
  const mid = base * clamp(Math.exp(-INDUSTRY.sensitivity * ((s.pressure[res] || 0) + delta / 2)), INDUSTRY.minFactor, INDUSTRY.maxFactor);
  const unit = side === 'sell' ? mid : mid * INDUSTRY.buySpread;
  return Math.round(unit * qty);
}

export function sellGoods(s, res, qty) {
  qty = Math.min(qty, s.inv[res] || 0);
  if (qty <= 0) return fail('Depoda bu maldan yok.');
  const total = goodsQuote(s, res, qty, 'sell');
  s.inv[res] -= qty;
  s.pressure[res] = (s.pressure[res] || 0) + RESOURCES[res].price * qty;
  s.money += total;
  s.stats.goodsSold += total;
  s.stats.moneyEarned += total;
  emit(s, 'goodsSold', { res, qty, total });
  return ok({ qty, total });
}

export function buyGoods(s, res, qty) {
  if (qty <= 0) return fail('Geçersiz miktar.');
  if (freeSpace(s, res) < qty) return fail('Depoda yer yok. Depoyu büyüt.');
  const total = goodsQuote(s, res, qty, 'buy');
  if (s.money < total) return fail('Yeterli para yok.');
  s.money -= total;
  s.inv[res] += qty;
  s.pressure[res] = (s.pressure[res] || 0) - RESOURCES[res].price * qty;
  return ok({ qty, total });
}

function goodsDecay(s, dt) {
  const f = Math.exp(-dt / (INDUSTRY.decayHours * HOUR));
  for (const k of Object.keys(s.pressure)) {
    s.pressure[k] *= f;
    if (Math.abs(s.pressure[k]) < 0.01) s.pressure[k] = 0;
  }
}

// ---------- Malzemeler ----------

export function matsFor(type) {
  return MATS[type] || {};
}

export function missingMats(s, mats) {
  const out = {};
  for (const [k, n] of Object.entries(mats)) if ((s.inv[k] || 0) < n) out[k] = n - (s.inv[k] || 0);
  return out;
}

export function matsText(mats) {
  return Object.entries(mats).map(([k, n]) => `${n} ${RESOURCES[k].name}`).join(', ');
}

function takeMats(s, mats) {
  for (const [k, n] of Object.entries(mats)) s.inv[k] -= n;
}

function matsValue(mats) {
  return Object.entries(mats).reduce((a, [k, n]) => a + RESOURCES[k].price * n, 0);
}

// Eksik malzemeleri pazardan almanın tutarı
export function missingCost(s, mats) {
  return Object.entries(missingMats(s, mats)).reduce((a, [k, n]) => a + goodsQuote(s, k, n, 'buy'), 0);
}

export function buyMissing(s, mats) {
  const miss = missingMats(s, mats);
  const total = missingCost(s, mats);
  if (s.money < total) return fail('Eksik malzemeleri almaya para yetmiyor.');
  for (const [k, n] of Object.entries(miss)) {
    const r = buyGoods(s, k, n);
    if (!r.ok) return r;
  }
  return ok({ total });
}

// ---------- Bina yükseltme ----------

export function levelMult(b) {
  const ups = UPGRADES[b.type];
  if (!ups || !b.level || b.level <= 1) return 1;
  return ups[b.level - 2].mult;
}

export function nextUpgrade(b) {
  const ups = UPGRADES[b.type];
  const lvl = b.level || 1;
  if (!ups || lvl > ups.length) return null;
  const u = ups[lvl - 1];
  return { level: lvl + 1, mats: u.mats, mult: u.mult, costFactor: u.cost };
}

export function upgradeCost(s, b) {
  const u = nextUpgrade(b);
  if (!u) return 0;
  return Math.round(def(b.type).cost * u.costFactor * marketIndex(s) / 100);
}

export function upgrade(s, id) {
  const b = s.buildings[id];
  const u = b && nextUpgrade(b);
  if (!u) return fail('Bu bina daha fazla yükseltilemez.');
  const cost = upgradeCost(s, b);
  if (s.money < cost) return fail('Yeterli para yok.');
  const miss = missingMats(s, u.mats);
  if (Object.keys(miss).length) return fail(`Eksik malzeme: ${matsText(miss)}`, { missing: miss });
  s.money -= cost;
  takeMats(s, u.mats);
  b.level = u.level;
  b.paid = (b.paid || 0) + cost + matsValue(u.mats);
  changed(s);
  addXp(s, Math.round(cost / 30));
  emit(s, 'upgraded', { id, x: b.x, y: b.y, level: b.level });
  return ok({ level: b.level, cost });
}

// Görünüm: seviyeye ya da kurulan görünüme göre görsel adı
export function spriteKey(b) {
  if (b.level > 1 && UPGRADES[b.type]) return `${b.type}-${b.level}`;
  return b.variant || b.type;
}

// ---------- Başarımlar ----------

let achCheckedAt = -Infinity;
function checkAchievements(s) {
  if (s.gameTime - achCheckedAt < 20 * 1000 && s.gameTime >= achCheckedAt) return;
  achCheckedAt = s.gameTime;
  for (const a of ACHIEVEMENTS) {
    if (s.achieved.includes(a.id)) continue;
    if (achievementProgress(s, a) >= a.n) {
      s.achieved.push(a.id);
      s.diamonds += a.reward.diamonds || 0;
      s.money += a.reward.money || 0;
      emit(s, 'achievement', { id: a.id, text: a.text, reward: a.reward });
    }
  }
}

export function achievementProgress(s, a) {
  const all = allBuildings(s);
  switch (a.kind) {
    case 'count': return all.filter(b => b.type === a.type).length;
    case 'cat': return all.filter(b => def(b.type).cat === a.cat).length;
    case 'catAny': return all.filter(b => a.cats.includes(def(b.type).cat)).length;
    case 'maxLevel': return Math.max(1, ...all.map(b => b.level || 1));
    case 'stat': return s.stats[a.stat] || 0;
    case 'happy': return Object.values(s.buildings).filter(h => isHouse(h) && h.contract && satisfaction(s, h) >= CONFIG.satHappy).length;
    case 'produced': return s.stats.produced[a.res] || 0;
    case 'hoods': return s.hoodsOpen.length;
    case 'sets': return s.collectionSets || 0;
    case 'premium': return all.filter(b => def(b.type).premium).length;
    case 'netWorth': return netWorth(s);
    default: return 0;
  }
}

// Bütün mahallelerdeki binalar
export function allBuildings(s) {
  return [...Object.values(s.buildings), ...Object.values(s.hoods || {}).flatMap(h => Object.values(h.buildings))];
}

// ---------- Emlak piyasası ----------

function ensureMarket(s, id) {
  if (!s.market) return;
  if (!s.market.hoods[id]) {
    s.market.hoods[id] = { index: CONFIG.market.start, base: CONFIG.market.start, event: null, hist: [CONFIG.market.start] };
  }
}

export function marketOf(s, id = s.hood) {
  return s.market?.hoods[id] || { index: 100, base: 100, event: null, hist: [100] };
}

export function marketIndex(s, id = s.hood) {
  return Math.round(marketOf(s, id).index * 10) / 10;
}

// Binanın piyasa değeri: ödenen × (şimdiki endeks / alındığı andaki endeks)
export function marketValue(s, b, idx = marketIndex(s)) {
  return (b.paid || 0) * idx / (b.paidIndex || 100);
}

export function sellValue(s, b, idx) {
  return Math.round(marketValue(s, b, idx) * CONFIG.sellRate);
}

// Görüntülenen mahallenin endeks hedefi ve bileşenleri
export function marketBreakdown(s) {
  const M = CONFIG.market;
  const houses = Object.values(s.buildings).filter(isHouse);
  const parts = { happy: 0, vacant: 0, placement: 0, artists: 0 };
  if (houses.length) {
    const happy = houses.filter(h => h.contract && satisfaction(s, h) >= CONFIG.satHappy).length;
    const vacant = houses.filter(h => !h.contract && !h.renewal).length;
    const avgBonus = houses.reduce((a, h) => a + bonusAt(s, h.x, h.y).total, 0) / houses.length;
    const artists = houses.filter(h => h.contract?.tenant === 'sanatci').length;
    parts.happy = happy / houses.length * M.happyWeight;
    parts.vacant = -vacant / houses.length * M.vacantWeight;
    parts.placement = clamp(avgBonus * M.bonusWeight, -10, 15);
    parts.artists = Math.min(M.artistMax, artists * M.artistEach);
  }
  const base = clamp(100 + parts.happy + parts.vacant + parts.placement + parts.artists, M.min, M.max);
  return { parts, base, houses: houses.length };
}

export function eventOf(s, id = s.hood) {
  const e = marketOf(s, id).event;
  if (!e || e.until <= s.gameTime) return null;
  return { ...MARKET_EVENTS.find(m => m.id === e.id), until: e.until };
}

export function marketTarget(s, id = s.hood) {
  const m = marketOf(s, id);
  const ev = eventOf(s, id);
  return clamp(m.base + (ev ? ev.effect : 0), CONFIG.market.min, CONFIG.market.max);
}

function marketTick(s, dt, rng) {
  if (!s.market) return;
  const M = CONFIG.market;
  const cur = s.market.hoods[s.hood];
  if (cur) cur.base = marketBreakdown(s).base;
  // endeks hedefe yavaşça yaklaşır
  const k = 1 - Math.exp(-M.driftPerHour * dt / HOUR);
  for (const id of s.hoodsOpen) {
    const m = s.market.hoods[id];
    if (!m) continue;
    if (m.event && m.event.until <= s.gameTime) m.event = null;
    m.index = clamp(m.index + (marketTarget(s, id) - m.index) * k, M.min, M.max);
  }
  // olaylar
  for (let i = 0; i < 10 && s.gameTime >= s.market.nextEventAt; i++) {
    s.market.nextEventAt += M.eventEveryHours * HOUR;
    startRandomEvent(s, rng);
  }
  // grafik kaydı
  for (let i = 0; i < 40 && s.gameTime >= s.market.nextHistAt; i++) {
    s.market.nextHistAt += M.historyEveryHours * HOUR;
    for (const id of s.hoodsOpen) {
      const m = s.market.hoods[id];
      m.hist.push(Math.round(m.index));
      if (m.hist.length > M.historyLength) m.hist.shift();
    }
  }
}

export function startRandomEvent(s, rng = Math.random, hoodId = null, eventId = null) {
  const free = s.hoodsOpen.filter(id => !eventOf(s, id));
  if (!free.length) return null;
  const id = hoodId || free[Math.floor(rng() * free.length) % free.length];
  const pool = MARKET_EVENTS.filter(e => !e.hoods || e.hoods.includes(id));
  const ev = eventId ? MARKET_EVENTS.find(e => e.id === eventId) : pool[Math.floor(rng() * pool.length) % pool.length];
  s.market.hoods[id].event = { id: ev.id, until: s.gameTime + ev.hours * HOUR };
  emit(s, 'marketEvent', { hood: id, text: ev.text, effect: ev.effect });
  return ev;
}

// ---------- Seviye ----------

export function xpToNext(level) {
  return Math.round(CONFIG.xpBase * Math.pow(CONFIG.xpGrowth, level - 1));
}

export function addXp(s, amount) {
  s.xp += amount;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    const reward = CONFIG.levelUpMoneyPerLevel * s.level;
    s.money += reward;
    s.diamonds += CONFIG.diamondsPerLevel;
    emit(s, 'levelUp', { level: s.level, reward, diamonds: CONFIG.diamondsPerLevel });
  }
}

// Net değer: nakit + binaların satış değeri + arsalar (güncel endeksle)
export function netWorth(s) {
  let v = s.money;
  for (const [k, r] of Object.entries(RESOURCES)) v += (s.inv?.[k] || 0) * r.price;
  const all = [[s.hood, { buildings: s.buildings, parcelsPaid: s.parcelsPaid }], ...Object.entries(s.hoods || {})];
  for (const [id, hd] of all) {
    const idx = marketIndex(s, id);
    v += (hd.parcelsPaid || 0) * idx / 100;
    for (const b of Object.values(hd.buildings)) v += sellValue(s, b, idx);
  }
  return Math.round(v);
}

// ---------- Görevler ----------

export function currentQuest(s) {
  return QUESTS[s.questIndex] || null;
}

export function questProgress(s, q) {
  const all = Object.values(s.buildings);
  const houses = all.filter(isHouse);
  switch (q.kind) {
    case 'count': return countOf(s, q.type);
    case 'houses': return houses.length;
    case 'connectedHouses': return houses.filter(h => isConnected(s, h)).length;
    case 'stat': return s.stats[q.stat] || 0;
    case 'houseNear': return houses.filter(h => affectedByType(s, h.x, h.y, q.type)).length;
    case 'demandMet': return houses.filter(h => h.contract && demandMet(s, h, h.contract.demand)).length;
    case 'parcels': return s.parcels.length;
    case 'level': return s.level;
    case 'netWorth': return netWorth(s);
    case 'hoods': return s.hoodsOpen.length;
    default: return 0;
  }
}

export function questComplete(s) {
  const q = currentQuest(s);
  return !!q && questProgress(s, q) >= q.n;
}

export function claimQuest(s) {
  const q = currentQuest(s);
  if (!q || !questComplete(s)) return fail('Görev henüz bitmedi.');
  s.money += q.reward.money || 0;
  s.diamonds += q.reward.diamonds || 0;
  if (q.reward.xp) addXp(s, q.reward.xp);
  s.questIndex++;
  emit(s, 'quest', { reward: q.reward });
  return ok({ reward: q.reward });
}

// ---------- Yardımcılar ----------

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function fail(msg, extra = {}) {
  return { ok: false, msg, ...extra };
}

export function formatDuration(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return m ? `${h} sa ${m} dk` : `${h} sa`;
  if (m > 0) return s && m < 10 ? `${m} dk ${s} sn` : `${m} dk`;
  return `${s} sn`;
}

export function formatMinutes(min) {
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} sa ${m} dk` : `${h} saat`;
}

export function formatMoney(n) {
  return Math.round(n).toLocaleString('tr-TR');
}
