// Oyunun bütün rakamları burada. Kodu bozmadan denge ayarı için yalnız bu dosya değişir.
// Rakamlar ilk tahmindir; oynayarak ayarlanacak.

export const CONFIG = {
  gridSize: 12,          // harita 12x12 kare
  parcelSize: 4,         // her arsa parseli 4x4 kare (toplam 3x3 = 9 parsel)
  avenueX: 5,            // bu sütun boydan boya ana cadde (silinemez, yollar buna bağlanır)
  startParcels: [[1, 1]],
  parcelBaseCost: 600,   // 2. parselin fiyatı
  parcelGrowth: 1.6,     // her yeni parsel bir öncekinden bu kadar kat pahalı

  startMoney: 1500,
  buildCostGrowth: 1.25, // aynı türden her yeni bina bu kadar kat pahalı
  sellRefund: 0.5,       // satınca ödenen paranın yarısı geri gelir
  netWorthBuildingRate: 0.7, // net değerde binalar ödenen fiyatın %70'i sayılır

  // Etki alanı
  stackCapPerType: 30,   // aynı tür binadan gelen etki en fazla ±%30
  bonusMax: 100,         // bir evin toplam bonusu en fazla +%100
  bonusMin: -60,         // en az -%60

  // Kira
  rentDurationExponent: -0.2, // uzun kontrat saat başına biraz daha az kazandırır
  signingFeeRate: 0.10,       // kontrat imza ücreti: toplam kiranın %10'u
  demandMetRentBonus: 0.15,   // talebi karşılanan kiracı %15 fazla öder
  cardsPerHouse: 3,

  // Memnuniyet (0-100)
  satBase: 60,
  satDemandMet: 30,
  satDemandMissed: -10,
  satDislikeNearby: -20,
  satLatePerHour: 10,     // kira toplanmadığı her saat -10
  satHappy: 70,           // bu ve üstü: yenilemede imza ücreti yok

  commercialStorageHours: 3, // ticari gelir en fazla 3 saatlik birikir

  // Seviye
  xpBase: 40,
  xpGrowth: 1.45,
  levelUpMoneyPerLevel: 100,

  speeds: [1, 10, 60],   // test için zaman hızlandırma
};

// cat: konut | ticari | kamu | sanayi | simge | yol
// size: kaç kare kapladığı (2 = 2x2). Etki alanı binanın kenarından ölçülür.
// smoke: bacadan duman (bir ya da birkaç baca), sparkle: su parıltısı (görsel süs, oyunu etkilemez).
//   x, y: bina alanının merkezinden kayma (kare), h: yükseklik (piksel)
// effect: { radius, all, tenants: { kiracıId: ek yüzde } } — radius kare tabanlı (radius 1 = 3x3 alan)
export const BUILDINGS = {
  yol: { name: 'Yol', cat: 'yol', icon: '', cost: 0, unlock: 1 },

  ev: {
    name: 'Müstakil Ev', cat: 'konut', icon: '🏠', cost: 250, unlock: 1,
    rentPerHour: 150, height: 18,
  },
  apartman: {
    name: 'Apartman', cat: 'konut', icon: '🏢', cost: 900, unlock: 3,
    rentPerHour: 420, height: 40,
  },
  villa: {
    name: 'Villa', cat: 'konut', icon: '🏡', cost: 2600, unlock: 6,
    rentPerHour: 1000, height: 22, sparkle: { x: -0.22, y: 0.31, h: 1, spread: 0.1 }, // havuz parıltısı (img/binalar/villa.png'deki havuz)
  },

  kafe: {
    name: 'Kafe', cat: 'ticari', icon: '☕', cost: 400, unlock: 1,
    incomePerHour: 40, height: 16,
    effect: { radius: 2, all: 5, tenants: { ogrenci: 10, genc: 5 } },
  },
  market: {
    name: 'Market', cat: 'ticari', icon: '🛒', cost: 700, unlock: 2,
    incomePerHour: 70, height: 18,
    effect: { radius: 2, all: 8, tenants: { genc: 6, aile: 4 } },
  },
  gece: {
    name: 'Gece Kulübü', cat: 'ticari', icon: '🪩', cost: 1200, unlock: 5,
    incomePerHour: 180, height: 20,
    effect: { radius: 2, all: 0, tenants: { ogrenci: 20, genc: 8, aile: -15, emekli: -25 } },
  },

  park: {
    name: 'Park', cat: 'kamu', icon: '🌳', cost: 250, unlock: 1,
    height: 0, sparkle: { h: 5, spread: 0.12 }, // çeşme suyunda parıltı
    effect: { radius: 1, all: 6, tenants: { aile: 8, emekli: 12 } },
  },
  okul: {
    name: 'Okul', cat: 'kamu', icon: '🏫', cost: 1500, unlock: 4,
    height: 26,
    effect: { radius: 2, all: 3, tenants: { aile: 20, ogrenci: 4 } },
  },
  metro: {
    name: 'Metro Durağı', cat: 'kamu', icon: '🚇', cost: 2000, unlock: 7,
    height: 10,
    effect: { radius: 3, all: 6, tenants: { ogrenci: 8, genc: 12 } },
  },

  atolye: {
    name: 'Atölye', cat: 'sanayi', icon: '🏭', cost: 800, unlock: 3,
    incomePerHour: 220, height: 28,
    smoke: { x: 0.234, y: -0.234, h: 35 }, // img/binalar/atolye.png'deki baca
    effect: { radius: 2, all: -8, tenants: { aile: -10, emekli: -12, genc: -4 } },
  },

  // ---- Sonradan eklenen binalar (rakamlar ilk tahmin) ----
  rezidans: {
    name: 'Rezidans', cat: 'konut', icon: '🏙️', cost: 5200, unlock: 9,
    rentPerHour: 1900, height: 56,
  },
  banka: {
    name: 'Banka', cat: 'ticari', icon: '🏦', cost: 3000, unlock: 8,
    incomePerHour: 320, height: 24,
    effect: { radius: 2, all: 6, tenants: { genc: 8 } },
  },
  avm: {
    name: 'AVM', cat: 'ticari', icon: '🛍️', cost: 9000, unlock: 12, size: 2,
    incomePerHour: 950, height: 22,
    effect: { radius: 3, all: 10, tenants: { genc: 8, aile: 6, ogrenci: 6 } },
  },
  lojistik: {
    name: 'Lojistik Depo', cat: 'sanayi', icon: '🚚', cost: 3500, unlock: 8,
    incomePerHour: 620, height: 18,
    effect: { radius: 2, all: -6, tenants: { aile: -6, emekli: -8 } },
  },
  fabrika: {
    name: 'Fabrika', cat: 'sanayi', icon: '🏗️', cost: 6000, unlock: 10, size: 2,
    incomePerHour: 1400, height: 30,
    smoke: [{ x: 0.371, y: -0.371, h: 37 }, { x: -0.023, y: 0.023, h: 37 }], // img/binalar/fabrika.png'deki iki baca
    effect: { radius: 3, all: -12, tenants: { aile: -10, emekli: -12, genc: -5 } },
  },
  hastane: {
    name: 'Hastane', cat: 'kamu', icon: '🏥', cost: 4000, unlock: 9,
    height: 34,
    effect: { radius: 3, all: 4, tenants: { emekli: 20, aile: 8 } },
  },
  saatkulesi: {
    name: 'Saat Kulesi', cat: 'simge', icon: '🕰️', cost: 8000, unlock: 11,
    height: 60,
    effect: { radius: 4, all: 10 },
  },
  stadyum: {
    name: 'Stadyum', cat: 'simge', icon: '🏟️', cost: 15000, unlock: 14, size: 2,
    height: 20,
    effect: { radius: 5, all: 12, tenants: { genc: 6, ogrenci: 6, emekli: -6 } },
  },
  gokdelen: {
    name: 'Gökdelen', cat: 'simge', icon: '🗼', cost: 20000, unlock: 16,
    height: 80,
    effect: { radius: 5, all: 15 },
  },
};

export const CATEGORIES = {
  konut: { name: 'Konut', hint: 'Kiracı alır, kira getirir' },
  ticari: { name: 'Ticari', hint: 'Kendi geliri + çevreye kira bonusu' },
  kamu: { name: 'Kamu ve yeşil', hint: 'Gelir yok, çevreye güçlü bonus' },
  sanayi: { name: 'Sanayi', hint: 'Yüksek gelir, çevreye olumsuz etki' },
  simge: { name: 'Simge yapı', hint: 'Pahalı ve nadir; çok geniş alana bonus' },
};

// durations dakika cinsinden
export const TENANTS = {
  ogrenci: {
    name: 'Öğrenci', icon: '🎒', durations: [5, 15, 30], rentMult: 0.6,
    likes: ['kafe', 'gece', 'metro'], dislikes: [],
  },
  genc: {
    name: 'Genç çalışan', icon: '💼', durations: [60, 120, 240], rentMult: 1.0,
    likes: ['metro', 'market', 'kafe'], dislikes: ['atolye'],
  },
  aile: {
    name: 'Aile', icon: '👨‍👩‍👧', durations: [240, 360, 480], rentMult: 1.2,
    likes: ['okul', 'park'], dislikes: ['gece', 'atolye'],
  },
  emekli: {
    name: 'Emekli', icon: '👴', durations: [480, 600, 720], rentMult: 1.0,
    likes: ['park'], dislikes: ['gece', 'atolye'],
  },
};

// Danışman görevleri: sırayla açılır, oyunu öğretir.
export const QUESTS = [
  { text: 'Bir müstakil ev kur', kind: 'count', type: 'ev', n: 1, reward: { money: 100, xp: 10 } },
  { text: 'Evini ana caddeye yolla bağla', kind: 'connectedHouses', n: 1, reward: { money: 100, xp: 10 } },
  { text: 'Eve bir kiracı yerleştir', kind: 'stat', stat: 'contractsSigned', n: 1, reward: { money: 100, xp: 10 } },
  { text: 'İlk kiranı topla', kind: 'stat', stat: 'rentsCollected', n: 1, reward: { money: 150, xp: 15 } },
  { text: 'Bir evin yanına park kur', kind: 'houseNear', type: 'park', n: 1, reward: { money: 200, xp: 20 } },
  { text: 'Talebi karşılanan bir kiracın olsun', kind: 'demandMet', n: 1, reward: { money: 250, xp: 25 } },
  { text: '4 evin olsun', kind: 'houses', n: 4, reward: { money: 300, xp: 30 } },
  { text: 'Yeni bir arsa parseli aç', kind: 'parcels', n: 2, reward: { money: 400, xp: 40 } },
  { text: 'Seviye 5\'e ulaş', kind: 'level', n: 5, reward: { money: 600, xp: 0 } },
  { text: 'Net değerini 10.000\'e çıkar', kind: 'netWorth', n: 10000, reward: { money: 1000, xp: 100 } },
];
