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
  sellRate: 0.8,         // bina piyasa değerinin %80'ine satılır (piyasa değeri = ödenen × endeks / alıştaki endeks)

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

  // Elmas (premium): seviye atlayınca ve görevlerden gelir; kontratı hemen bitirmeye harcanır
  diamondsPerLevel: 2,
  startDiamonds: 5,
  rushDiamondsPerHour: 1, // kalan her (başlamış) saat için 1 elmas

  // Emlak piyasası: her mahallenin değer endeksi (%)
  market: {
    min: 70, max: 140, start: 100,
    driftPerHour: 0.15,        // endeks her oyun saatinde hedefe kalan farkın ~%15'i kadar yaklaşır
    happyWeight: 20,           // memnun kiracı oranı × 20
    vacantWeight: 10,          // boş ev oranı × -10
    bonusWeight: 0.5,          // ortalama konum bonusu × 0.5 (en çok +15, en az -10)
    artistEach: 3, artistMax: 15, // her kiracılı sanatçı +3 (en çok +15)
    eventEveryHours: 24,       // her 24 oyun saatinde bir mahallede bir olay
    historyEveryHours: 6,      // grafik için 6 saatte bir kayıt
    historyLength: 28,
  },

  // Kiracı hikayeleri
  storyAfterRenewals: 2,   // aynı kiracı 2 kez yenileyince
  storyChance: 0.6,        // memnun toplamada bu şansla hikaye başlar
  storyHours: 48,          // isteği karşılamak için süre (oyun saati)
  storySatBonus: 15,       // tamamlanınca kiracının memnuniyetine kalıcı ek

  // Koleksiyon: kira toplarken düşen parçalar; set tamamlanınca kalıcı kira bonusu
  collectionDropChance: 0.12,
  collectionSetBonus: 2, // her tamamlanan set kiraya kalıcı +%2
  collectionSetMax: 10,  // en fazla 10 set (+%20)
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
    effect: { radius: 2, all: 5, tenants: { ogrenci: 10, genc: 5, sanatci: 8 } },
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
    effect: { radius: 2, all: -8, tenants: { aile: -10, emekli: -12, genc: -4, sanatci: 10, unlu: -10 } },
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
    effect: { radius: 3, all: 10, tenants: { genc: 8, aile: 6, ogrenci: 6, sanatci: -10 } },
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
    effect: { radius: 4, all: 10, tenants: { unlu: 8 } },
  },
  stadyum: {
    name: 'Stadyum', cat: 'simge', icon: '🏟️', cost: 15000, unlock: 14, size: 2,
    height: 20,
    effect: { radius: 5, all: 12, tenants: { genc: 6, ogrenci: 6, emekli: -6, unlu: -10 } },
  },
  // ---- Süslemeler: ucuz, küçük alana küçük bonus ----
  'dekor-cicek': {
    name: 'Çiçek Tarhı', cat: 'dekor', icon: '🌷', cost: 120, unlock: 1, height: 2,
    effect: { radius: 1, all: 3, tenants: { aile: 2, emekli: 3 } },
  },
  'dekor-lamba': {
    name: 'Bank ve Lamba', cat: 'dekor', icon: '💡', cost: 150, unlock: 2, height: 8,
    effect: { radius: 1, all: 3, tenants: { genc: 2 } },
  },
  'dekor-cesme': {
    name: 'Küçük Çeşme', cat: 'dekor', icon: '⛲', cost: 200, unlock: 2, height: 8,
    sparkle: { h: 8, spread: 0.08 },
    effect: { radius: 1, all: 4 },
  },
  'dekor-oyun': {
    name: 'Oyun Parkı', cat: 'dekor', icon: '🛝', cost: 400, unlock: 3, height: 8,
    effect: { radius: 1, all: 2, tenants: { aile: 10, emekli: -3 } },
  },
  'dekor-kamelya': {
    name: 'Kamelya', cat: 'dekor', icon: '🛖', cost: 350, unlock: 4, height: 14,
    effect: { radius: 1, all: 4, tenants: { emekli: 4 } },
  },
  'dekor-heykel': {
    name: 'Heykel', cat: 'dekor', icon: '🐎', cost: 600, unlock: 6, height: 20,
    effect: { radius: 2, all: 5, tenants: { sanatci: 6, unlu: 4 } },
  },

  // ---- Nadir süslemeler: yalnız kiracı hikayesi tamamlanınca açılır (rare: true) ----
  'nadir-cinar': {
    name: 'Asırlık Çınar', cat: 'dekor', icon: '🌳', cost: 900, unlock: 1, height: 30, rare: true,
    effect: { radius: 2, all: 8, tenants: { emekli: 6, sanatci: 4 } },
  },
  'nadir-havuz': {
    name: 'Nilüferli Havuz', cat: 'dekor', icon: '🪷', cost: 1200, unlock: 1, height: 4, rare: true,
    sparkle: { h: 3, spread: 0.2 },
    effect: { radius: 2, all: 9, tenants: { aile: 6, unlu: 6 } },
  },
  'nadir-saat': {
    name: 'Antika Sokak Saati', cat: 'dekor', icon: '🕰️', cost: 1000, unlock: 1, height: 26, rare: true,
    effect: { radius: 2, all: 7, tenants: { genc: 8 } },
  },
  'nadir-gul': {
    name: 'Gül Bahçesi', cat: 'dekor', icon: '🌹', cost: 1100, unlock: 1, height: 14, rare: true,
    effect: { radius: 2, all: 8, tenants: { aile: 4, genc: 4, unlu: 4 } },
  },

  gokdelen: {
    name: 'Gökdelen', cat: 'simge', icon: '🗼', cost: 20000, unlock: 16,
    height: 80,
    effect: { radius: 5, all: 15, tenants: { unlu: 12 } },
  },
};

// Arazi özellikleri: dokümandaki "bazı parsellerde nehir, tepe gibi özellikler olur" kuralı.
// buildable: üstüne bina/yol yapılabilir mi; nearBonus: radius içindeki evlere bonus; onBonus: üstündeki eve bonus.
export const TERRAIN = {
  nehir: { name: 'Nehir', sprite: 'zemin-nehir', buildable: false, nearBonus: { radius: 1, all: 8 } },
  tepe: { name: 'Tepe', sprite: 'zemin-tepe', buildable: true, onBonus: 10 },
  deniz: { name: 'Deniz', sprite: 'zemin-deniz', buildable: false, nearBonus: { radius: 2, all: 15 } },
  kiyi: { name: 'Kıyı', sprite: 'zemin-kiyi', buildable: false },
  kum: { name: 'Kumsal', sprite: 'zemin-kum', buildable: true },
};

const row = (y, type, skip = []) => [...Array(12).keys()].filter(x => !skip.includes(x)).map(x => [x, y, type]);

// Mahalleler. Para, seviye ve elmas ortak; her mahallenin kendi haritası, binaları ve arsaları var.
// rule: mahalleye özel kural (game.js içinde uygulanır)
//   deniz: deniz manzarası (deniz karesine 2 kare yakın eve +%15)
//   kirlilik: olumsuz etkiler 1 kare daha geniş
//   golge: yüksek binalar (tall) yanındaki evlere -%10
//   tepe: bütün kareler tepe (+%10), ünlü her eve gelir, az arsa
export const HOODS = {
  eski: {
    name: 'Eski Çarşı', icon: '🏘️', unlock: 1, openCost: 0,
    hint: 'Başlangıç mahallesi. Nehir ve tepeler var.',
    avenue: { x: 5, y0: 0, y1: 11 },
    terrain: [...row(10, 'nehir', [5]), [9, 1, 'tepe'], [10, 1, 'tepe'], [10, 2, 'tepe'], [11, 2, 'tepe']],
    parcelBaseCost: 600,
  },
  sahil: {
    name: 'Sahil', icon: '🏖️', unlock: 8, openCost: 15000, rule: 'deniz',
    hint: 'Deniz manzarası: denize 2 kare yakın evler +%15 alır.',
    avenue: { x: 5, y0: 0, y1: 9 },
    terrain: [...row(11, 'deniz'), ...row(10, 'kiyi'), ...row(9, 'kum', [5]), ...row(8, 'kum', [5])],
    parcelBaseCost: 2500,
  },
  sanayi: {
    name: 'Sanayi Bölgesi', short: 'Sanayi', icon: '🏭', unlock: 15, openCost: 60000, rule: 'kirlilik',
    hint: 'Kirlilik: olumsuz etkiler 1 kare daha geniş yayılır. Sanayi geliri +%25.',
    avenue: { x: 5, y0: 0, y1: 11 },
    groundTile: 'zemin-beton', industryBonus: 0.25,
    terrain: [],
    parcelBaseCost: 6000,
  },
  is: {
    name: 'İş Merkezi', short: 'İş Mrk.', icon: '🏙️', unlock: 22, openCost: 200000, rule: 'golge',
    hint: 'Yükseklik: gökdelen, rezidans ve saat kulesi yanındaki evlerin manzarasını kapatır (-%10).',
    avenue: { x: 5, y0: 0, y1: 11 },
    groundTile: 'zemin-beton',
    terrain: [],
    parcelBaseCost: 20000,
  },
  tepe: {
    name: 'Tepe Villaları', short: 'Tepe', icon: '⛰️', unlock: 30, openCost: 600000, rule: 'tepe',
    hint: 'Az arsa, çok yüksek değer. Her kare tepe (+%10); ünlüler her eve gelir.',
    avenue: { x: 5, y0: 0, y1: 11 },
    allTerrain: 'tepe',
    terrain: [],
    buyable: ['1,1', '2,1', '1,2', '2,2'], // yalnız bu parseller açılabilir
    parcelBaseCost: 60000,
  },
};

// Gölge yapan yüksek binalar (İş Merkezi kuralı)
export const TALL = ['gokdelen', 'rezidans', 'saatkulesi'];

export const CATEGORIES = {
  konut: { name: 'Konut', hint: 'Kiracı alır, kira getirir' },
  ticari: { name: 'Ticari', hint: 'Kendi geliri + çevreye kira bonusu' },
  kamu: { name: 'Kamu ve yeşil', hint: 'Gelir yok, çevreye güçlü bonus' },
  sanayi: { name: 'Sanayi', hint: 'Yüksek gelir, çevreye olumsuz etki' },
  simge: { name: 'Simge yapı', hint: 'Pahalı ve nadir; çok geniş alana bonus' },
  dekor: { name: 'Süsleme', hint: 'Ucuz; yakın evlere küçük bonus' },
};

// durations dakika cinsinden. Portre görseli: img/ui/kiraci-<id>.png. unlock: hangi seviyede gelmeye başlar
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
    likes: ['park', 'hastane', 'dekor-kamelya'], dislikes: ['gece', 'atolye'],
  },
  sanatci: {
    name: 'Sanatçı', icon: '🎨', durations: [120, 240, 360], rentMult: 0.8, unlock: 4,
    likes: ['kafe', 'atolye', 'dekor-heykel'], dislikes: ['avm'],
  },
  unlu: {
    name: 'Ünlü', icon: '🌟', durations: [720, 1080, 1440], rentMult: 3.0, unlock: 9,
    houses: ['villa', 'rezidans'], // yalnız bu evlere gelir
    likes: ['gokdelen', 'saatkulesi', 'dekor-heykel'], dislikes: ['atolye', 'fabrika', 'lojistik', 'stadyum'],
  },
};

// Piyasa olayları: effect endeks hedefine eklenir, hours kadar sürer. hoods verilirse yalnız oralarda olur.
export const MARKET_EVENTS = [
  { id: 'metro', text: 'Metro hattı geliyor', effect: 15, hours: 48 },
  { id: 'festival', text: 'Mahalle festivali', effect: 6, hours: 24 },
  { id: 'avm', text: 'Yakına AVM açılacağı söyleniyor', effect: 8, hours: 36 },
  { id: 'turizm', text: 'Turizm sezonu başladı', effect: 14, hours: 48, hoods: ['sahil'] },
  { id: 'merkez', text: 'Büyük bir şirket genel merkezini taşıyor', effect: 14, hours: 48, hoods: ['is'] },
  { id: 'ihracat', text: 'İhracat rekoru: fabrikalar tam kapasite', effect: 10, hours: 36, hoods: ['sanayi'] },
  { id: 'unlu', text: 'Ünlü bir oyuncu buraya taşındı', effect: 12, hours: 36, hoods: ['tepe', 'sahil'] },
  { id: 'durgunluk', text: 'Ekonomik durgunluk', effect: -12, hours: 48 },
  { id: 'sel', text: 'Nehir taştı, sel uyarısı', effect: -10, hours: 36, hoods: ['eski'] },
  { id: 'kirlilik', text: 'Hava kirliliği şikayetleri arttı', effect: -8, hours: 36, hoods: ['sanayi', 'is'] },
  { id: 'yol', text: 'Uzun süren yol çalışması', effect: -6, hours: 24 },
];

// Kiracı hikayeleri: aynı kiracı en az storyAfterRenewals kez memnun yeniler ise bir istek getirir.
// request: near (evin yakınında şu binalardan biri olsun), pay (para), bonus (evin konum bonusu en az ...)
// reward: unlock (nadir süsleme açar), money, diamonds
export const STORIES = [
  { id: 'dugun', tenants: ['genc'], title: 'Evleniyoruz!', text: 'Düğünü bahçede yapmak istiyoruz. Masrafına ortak olur musun?',
    request: { kind: 'pay', amount: 1500 }, reward: { unlock: 'nadir-gul', diamonds: 2 } },
  { id: 'is', tenants: ['genc', 'sanatci'], title: 'Kendi işimi kuruyorum', text: 'Yakınlarda bir market ya da banka olursa işim çok kolaylaşır.',
    request: { kind: 'near', types: ['market', 'banka'] }, reward: { unlock: 'nadir-saat', diamonds: 2 } },
  { id: 'bebek', tenants: ['aile'], title: 'Bebeğimiz oldu!', text: 'Çocuğumuz büyüyünce oynayacağı bir yer olsun: yakına bir oyun parkı ya da okul.',
    request: { kind: 'near', types: ['dekor-oyun', 'okul'] }, reward: { unlock: 'nadir-havuz', diamonds: 2 } },
  { id: 'torun', tenants: ['emekli'], title: 'Torunlar geliyor', text: 'Torunlarımla yürüyüş yapacağım bir park olsun, gölgesinde oturalım.',
    request: { kind: 'near', types: ['park', 'dekor-kamelya'] }, reward: { unlock: 'nadir-cinar', diamonds: 2 } },
  { id: 'sergi', tenants: ['sanatci'], title: 'İlk sergim', text: 'Sergiyi mahallede açmak istiyorum. Evin çevresi güzel olsun (konum bonusu en az %15).',
    request: { kind: 'bonus', min: 15 }, reward: { unlock: 'nadir-cinar', money: 800 } },
  { id: 'mezun', tenants: ['ogrenci'], title: 'Mezun oldum!', text: 'Mezuniyet partisi için biraz destek olur musun?',
    request: { kind: 'pay', amount: 400 }, reward: { diamonds: 3, money: 0 } },
  { id: 'basin', tenants: ['unlu'], title: 'Basın toplantısı', text: 'Fotoğraflarda arkada bir simge yapı görünsün: saat kulesi ya da gökdelen.',
    request: { kind: 'near', types: ['saatkulesi', 'gokdelen'] }, reward: { unlock: 'nadir-gul', diamonds: 5 } },
];

export const COLLECTION = {
  tapu: { name: 'Tapu', image: 'koleksiyon-tapu' },
  anahtar: { name: 'Anahtar', image: 'koleksiyon-anahtar' },
  harita: { name: 'Eski Harita', image: 'koleksiyon-harita' },
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
  { text: 'Net değerini 10.000\'e çıkar', kind: 'netWorth', n: 10000, reward: { money: 1000, xp: 100, diamonds: 3 } },
  { text: 'Seviye 8\'e ulaş: Sahil açılır', kind: 'level', n: 8, reward: { money: 3000, xp: 0, diamonds: 2 } },
  { text: 'Sahil mahallesini aç (Mahalle menüsü)', kind: 'hoods', n: 2, reward: { money: 5000, xp: 100, diamonds: 5 } },
];
