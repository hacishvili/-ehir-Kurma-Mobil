import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G0 from '../js/game.js';
import { CONFIG, BUILDINGS, HOODS } from '../js/data.js';

// Testler bir mahallenin kendi 12x12 alanındaki koordinatlarla yazıldı (eski ayrı haritalar).
// local(id): kare ve parsel koordinatlarını o mahallenin büyük haritadaki yerine kaydıran sarmalayıcı.
function local(id) {
  const [ox, oy] = HOODS[id].origin;
  const px0 = ox / CONFIG.parcelSize, py0 = oy / CONFIG.parcelSize;
  const xy = (i, j) => (...a) => { a[i] += ox; a[j] += oy; return a; };
  const shift = {
    build: xy(2, 3), move: xy(2, 3), bonusAt: xy(1, 2), buildingAt: xy(1, 2), canPlace: xy(1, 2),
    affectedByType: xy(1, 2), isRoadConnected: xy(1, 2), terrainAt: xy(0, 1), isAvenue: xy(0, 1),
    nearTerrain: xy(0, 1), inRadius: xy(1, 2),
    buyParcel: (s, px, py) => [s, px + px0, py + py0],
    parcelCost: (s, px = 1, py = 2) => [s, px + px0, py + py0],
  };
  return new Proxy(G0, { get: (t, k) => (shift[k] ? (...a) => t[k](...shift[k](...a)) : t[k]) });
}
const G = local('eski');
const AX = 5; // ana caddenin mahalle içindeki sütunu (büyük haritada x=17)

function rich() {
  const s = G.createState();
  s.money = 1e7;
  s.level = 20;
  // testlerde malzeme sıkıntısı olmasın
  s.depoLevel = 10;
  for (const k of Object.keys(s.inv)) s.inv[k] = 5000;
  return s;
}

test('ana caddeye komşu ev bağlıdır, uzaktaki değil', () => {
  const s = rich();
  const near = G.build(s, 'ev', AX + 1, 5);
  const far = G.build(s, 'ev', AX + 2, 5);
  assert.ok(near.ok && far.ok);
  assert.equal(G.isConnected(s, s.buildings[near.id]), true);
  assert.equal(G.isConnected(s, s.buildings[far.id]), false);
  // yol ile bağla
  G.build(s, 'yol', AX + 2, 6);
  G.build(s, 'yol', AX + 1, 6);
  assert.equal(G.isConnected(s, s.buildings[far.id]), true);
});

test('ana caddeye ve kilitli arsaya bina yapılamaz', () => {
  const s = rich();
  assert.equal(G.build(s, 'ev', AX, 5).ok, false);
  assert.equal(G.build(s, 'ev', 0, 0).ok, false);
});

test('etki alanı: park yanındaki eve bonus verir, aynı tür tavanı uygulanır', () => {
  const s = rich();
  const h = G.build(s, 'ev', 6, 6);
  G.build(s, 'park', 7, 7);
  const b = G.bonusAt(s, 6, 6);
  assert.equal(b.total, BUILDINGS.park.effect.all);
  // emekli için park ek bonus
  assert.equal(G.bonusAt(s, 6, 6, 'emekli').total, BUILDINGS.park.effect.all + BUILDINGS.park.effect.tenants.emekli);
  // çok park: tavan
  G.build(s, 'park', 7, 5);
  G.build(s, 'park', 7, 6);
  const capped = G.bonusAt(s, 6, 6, 'emekli');
  assert.equal(capped.total, CONFIG.stackCapPerType);
  assert.ok(h.ok);
});

test('olumsuz etki: atölye bonusu düşürür', () => {
  const s = rich();
  G.build(s, 'ev', 6, 6);
  G.build(s, 'atolye', 7, 4);
  assert.ok(G.bonusAt(s, 6, 6, 'aile').total < 0);
});

test('uzun kontrat saat başına daha az kazandırır', () => {
  const short = G.rentFor('ev', 'genc', 60, 0);
  const long = G.rentFor('ev', 'genc', 240, 0);
  assert.ok(long > short);
  assert.ok(long / 4 < short);
});

test('kontrat imzala, süre dolunca kira toplanır, yumuşak zamanlayıcı', () => {
  const s = rich();
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  G.generateCards(s, h, () => 0.1);
  const r = G.signContract(s, id, 0);
  assert.ok(r.ok, r.msg);
  assert.equal(G.houseStatus(s, h), 'kirada');
  assert.equal(G.collectRent(s, id).ok, false);

  G.advance(s, h.contract.minutes * G.MIN);
  assert.equal(G.houseStatus(s, h), 'hazir');
  const satOnTime = G.satisfaction(s, h);

  // 2 saat geç kal: kira kaybolmaz, memnuniyet düşer
  G.advance(s, 2 * G.HOUR);
  const satLate = G.satisfaction(s, h);
  assert.equal(satOnTime - satLate, 2 * CONFIG.satLatePerHour);
  const before = s.money;
  const c = G.collectRent(s, id);
  assert.ok(c.ok);
  assert.ok(s.money > before);
  assert.ok(h.renewal, 'memnun kiracı yenileme ister');
});

test('memnuniyet sıfırlanırsa kiracı gider ama kira yine alınır', () => {
  const s = rich();
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  G.generateCards(s, h, () => 0.1);
  G.signContract(s, id, 0);
  G.advance(s, h.contract.minutes * G.MIN + 20 * G.HOUR);
  assert.equal(G.satisfaction(s, h), 0);
  const r = G.collectRent(s, id);
  assert.ok(r.ok && r.amount > 0 && r.left);
  assert.equal(G.houseStatus(s, h), 'bos');
});

test('yenileme: memnun kiracıda imza ücreti yok', () => {
  const s = rich();
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  h.cards = [{ tenant: 'emekli', minutes: 480, demand: { kind: 'near', type: 'park' } }];
  G.build(s, 'park', AX + 2, 5);
  G.signContract(s, id, 0);
  assert.equal(G.satisfaction(s, h), CONFIG.satBase + CONFIG.satDemandMet);
  G.advance(s, 480 * G.MIN);
  G.collectRent(s, id);
  assert.equal(h.renewal.waiveFee, true);
  const money = s.money;
  assert.ok(G.signContract(s, id, 'renew').ok);
  assert.equal(s.money, money);
});

test('ticari gelir yalnız bağlıyken ve tavana kadar birikir', () => {
  const s = rich();
  const k = G.build(s, 'kafe', AX + 1, 5).id;
  const far = G.build(s, 'kafe', AX + 2, 7).id;
  G.advance(s, 10 * G.HOUR);
  assert.equal(Math.round(s.buildings[k].stored), G.storageCap('kafe'));
  assert.equal(s.buildings[far].stored, 0);
  assert.ok(G.collectIncome(s, k).ok);
});

test('taşıma bedava ve etkiyi değiştirir', () => {
  const s = rich();
  G.build(s, 'ev', 4, 4);
  const p = G.build(s, 'park', 7, 7).id;
  assert.equal(G.bonusAt(s, 4, 4).total, 0);
  const money = s.money;
  assert.ok(G.move(s, p, 4, 5).ok);
  assert.equal(s.money, money);
  assert.equal(G.bonusAt(s, 4, 4).total, BUILDINGS.park.effect.all);
});

test('parsel fiyatı artar', () => {
  const s = rich();
  const c1 = G.parcelCost(s);
  assert.ok(G.buyParcel(s, 1, 2).ok);
  assert.ok(G.parcelCost(s) > c1);
  assert.ok(G.build(s, 'ev', 4, 9).ok);
});

test('seviye atlama para ödülü verir', () => {
  const s = G.createState();
  const m = s.money;
  G.addXp(s, G.xpToNext(1));
  assert.equal(s.level, 2);
  assert.equal(s.money, m + CONFIG.levelUpMoneyPerLevel * 2);
});

test('kayıt ve geri yükleme', () => {
  const s = rich();
  G.build(s, 'ev', AX + 1, 5);
  const t = G.deserialize(G.serialize(s));
  assert.equal(Object.keys(t.buildings).length, 1);
  assert.equal(t.money, s.money);
  assert.equal(G.isConnected(t, Object.values(t.buildings)[0]), true);
});

test('görev zinciri ilerler', () => {
  const s = G.createState();
  assert.equal(G.questComplete(s), false);
  G.build(s, 'ev', AX + 1, 5);
  assert.equal(G.questComplete(s), true);
  assert.ok(G.claimQuest(s).ok);
  assert.equal(G.questComplete(s), true); // ev zaten caddeye bağlı
});

test('2x2 bina dört kare kaplar, kenarından yola bağlanır ve etkisi kenardan ölçülür', () => {
  const s = rich();
  s.level = 30;
  G.buyParcel(s, 2, 1);
  const r = G.build(s, 'avm', 7, 6); // 7..8 x 6..7
  assert.ok(r.ok, r.msg);
  for (const [x, y] of [[7, 6], [8, 6], [7, 7], [8, 7]]) assert.equal(G.buildingAt(s, x, y).id, r.id);
  assert.equal(G.build(s, 'ev', 8, 7).ok, false, 'dolu kareye bina yapılamaz');
  assert.equal(G.isConnected(s, s.buildings[r.id]), false);
  G.build(s, 'yol', 6, 7); // caddeye (x=5) komşu, AVM'nin sol kenarına komşu
  assert.equal(G.isConnected(s, s.buildings[r.id]), true);
  // radius 3: alanın sağ kenarı x=8, 3 kare ötesi x=11 etkilenir, 12 harita dışı
  assert.ok(G.inRadius(s.buildings[r.id], 11, 7, 3));
  assert.ok(!G.inRadius(s.buildings[r.id], 7, 11, 3));
  // kendi alanına etki etmez
  assert.equal(G.bonusAt(s, 8, 7).parts.some(p => p.type === 'avm'), false);
});

test('2x2 bina kilitli arsaya ya da caddeye taşamaz', () => {
  const s = rich();
  s.level = 30;
  assert.equal(G.build(s, 'avm', 7, 7).ok, false, 'y=8 kilitli parsel');
  assert.equal(G.build(s, 'avm', 4, 4).ok, false, 'x=5 ana cadde');
  assert.ok(G.build(s, 'avm', 6, 4).ok);
  const id = Object.values(s.buildings).find(b => b.type === 'avm').id;
  assert.equal(G.move(s, id, 7, 7).ok, false);
});

test('etkisinde kiracı ayrımı olmayan binalar da bonus verir', () => {
  const s = rich();
  s.level = 30;
  G.build(s, 'ev', 6, 6);
  assert.ok(G.build(s, 'saatkulesi', 4, 4).ok);
  assert.equal(G.bonusAt(s, 6, 6, 'aile').total, 10);
});

test('nehre bina yapılamaz, yol köprü olur; nehir kenarındaki ev ve tepedeki ev bonus alır', () => {
  const s = rich();
  G.buyParcel(s, 1, 2);
  assert.equal(G.terrainAt(6, 10), 'nehir');
  assert.equal(G.build(s, 'ev', 6, 10).ok, false);
  assert.ok(G.build(s, 'yol', 7, 10).ok, 'nehre yol yapılırsa köprü olur');
  assert.equal(G.bonusAt(s, 6, 9).total, 8, 'nehir manzarası');
  assert.equal(G.bonusAt(s, 6, 8).total, 0, 'nehirden uzak');
  G.buyParcel(s, 2, 0);
  assert.equal(G.terrainAt(10, 1), 'tepe');
  assert.ok(G.build(s, 'ev', 10, 1).ok, 'tepeye bina yapılabilir');
  assert.equal(G.bonusAt(s, 10, 1).total, 10, 'tepe bonusu');
});

test('sanatçı 4. seviyede, ünlü yalnız villa ve rezidansa gelir', () => {
  const s = G.createState();
  assert.ok(!G.availableTenants(s, 'ev').includes('sanatci'));
  s.level = 10;
  assert.ok(G.availableTenants(s, 'ev').includes('sanatci'));
  assert.ok(!G.availableTenants(s, 'ev').includes('unlu'));
  assert.ok(G.availableTenants(s, 'villa').includes('unlu'));
});

test('elmasla kontrat hemen biter', () => {
  const s = rich();
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  h.cards = [{ tenant: 'emekli', minutes: 480, demand: null }];
  G.signContract(s, id, 0);
  s.diamonds = 10;
  assert.equal(G.rushCost(s, h), 8);
  assert.ok(G.rushContract(s, id).ok);
  assert.equal(s.diamonds, 2);
  assert.equal(G.houseStatus(s, h), 'hazir');
});

test('koleksiyon parçası düşer, set tamamlanınca kira artar', () => {
  const s = rich();
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  h.cards = [{ tenant: 'genc', minutes: 60, demand: null }];
  G.signContract(s, id, 0);
  G.advance(s, 60 * G.MIN);
  const base = G.payoutFor(s, h);
  G.collectRent(s, id, () => 0); // şans: hep düşür, ilk parça
  assert.equal(Object.values(s.collection).reduce((a, b) => a + b, 0), 1);
  s.collection = { tapu: 1, anahtar: 1, harita: 1 };
  assert.ok(G.completeSet(s).ok);
  h.cards = [{ tenant: 'genc', minutes: 60, demand: null }];
  h.renewal = null;
  G.signContract(s, id, 0);
  G.advance(s, 60 * G.MIN);
  assert.ok(G.payoutFor(s, h) > base);
});

test('eski kayıt yeni alanlarla açılır', () => {
  const s = G.createState();
  delete s.diamonds; delete s.collection; delete s.collectionSets;
  const t = G.deserialize(JSON.stringify(s));
  assert.equal(t.diamonds, 5);
  assert.equal(t.collection.tapu, 0);
});

test('tek harita: mahalle seviye ve para ister, açılınca ilk arsası gelir, binalar yan yana durur', () => {
  const s = rich();
  s.level = 5;
  assert.equal(G0.openHood(s, 'sahil').ok, false, 'seviye 8 gerekli');
  assert.equal(G0.buyParcel(s, 4, 7).ok, false, 'kapalı mahallede arsa alınamaz');
  s.level = 8;
  const evId = G.build(s, 'ev', AX + 1, 5).id;
  const worthBefore = G0.netWorth(s);
  assert.ok(G0.openHood(s, 'sahil').ok);
  assert.ok(G0.isUnlocked(s, 17, 29), 'Sahilin ilk parseli açıldı');
  assert.equal(G0.netWorth(s), worthBefore, 'açılış parası arsa değeri olarak sayılır');
  const SA = local('sahil');
  const y = SA.build(s, 'ev', AX + 1, 5);
  assert.ok(y.ok, y.msg);
  assert.ok(s.buildings[evId] && s.buildings[y.id], 'iki mahallenin binaları aynı haritada');
  assert.equal(G0.hoodOf(s.buildings[y.id]), 'sahil');
  assert.equal(G0.hoodOf(s.buildings[evId]), 'eski');
});

test('arsa fiyatı her mahallede ayrı artar', () => {
  const s = rich();
  s.level = 8;
  G0.openHood(s, 'sahil');
  const sahil1 = G0.parcelCost(s, 5, 7);
  assert.ok(G.buyParcel(s, 1, 2).ok);
  assert.equal(G0.parcelCost(s, 5, 7), sahil1, 'Eski Çarşıda arsa almak Sahil fiyatını değiştirmez');
  assert.equal(sahil1, HOODS.sahil.parcelBaseCost);
});

test('Sahil: denize bina yapılamaz, deniz manzarası bonusu, cadde kumsalda biter', () => {
  const s = rich();
  s.level = 8;
  G0.openHood(s, 'sahil');
  const SA = local('sahil');
  SA.buyParcel(s, 1, 2);
  assert.equal(SA.build(s, 'ev', 6, 11).ok, false, 'deniz');
  assert.equal(SA.build(s, 'ev', 6, 10).ok, false, 'kıyı');
  assert.ok(SA.build(s, 'ev', 6, 9).ok, 'kum');
  assert.equal(SA.bonusAt(s, 6, 9).total, 15);
  assert.equal(SA.isAvenue(5, 10), false, 'cadde kıyıda biter');
  assert.equal(G.isAvenue(5, 10), true, 'Eski Çarşıda nehrin üstünden köprüyle geçer');
  assert.equal(G.isAvenue(5, 9), true);
});

test('Sanayi Bölgesi: kirlilik etkiyi genişletir, sanayi geliri artar', () => {
  const s = rich();
  s.level = 20;
  G.build(s, 'atolye', 7, 4);
  assert.equal(G.bonusAt(s, 7, 7).total, 0, 'Eski Çarşıda 3 kare uzak etkilenmez');
  G0.openHood(s, 'sanayi');
  const SN = local('sanayi');
  const id = SN.build(s, 'atolye', 7, 4).id;
  assert.ok(SN.bonusAt(s, 7, 7).total < 0, 'kirlilikle etkilenir');
  assert.ok(G0.incomeOf(s.buildings[id]) > 220);
  assert.ok(G0.incomePerHour('atolye', 'sanayi') > G0.incomePerHour('atolye', 'eski'));
});

test('İş Merkezi: yüksek bina yanındaki eve gölge', () => {
  const s = rich();
  s.level = 30;
  G0.openHood(s, 'is');
  const IS = local('is');
  IS.build(s, 'gokdelen', 7, 4);
  const near = IS.bonusAt(s, 7, 5).parts.find(p => p.type === 'golge');
  assert.equal(near.value, -10);
});

test('Tepe Villaları: her kare tepe, ünlü her eve, arsa sınırlı', () => {
  const s = rich();
  s.level = 30;
  G0.openHood(s, 'tepe');
  const TP = local('tepe');
  assert.equal(TP.terrainAt(6, 6), 'tepe');
  assert.ok(G0.availableTenants(s, 'ev', 'tepe').includes('unlu'));
  assert.ok(!G0.availableTenants(s, 'ev', 'eski').includes('unlu'));
  assert.equal(TP.buyParcel(s, 0, 0).ok, false);
  assert.ok(TP.buyParcel(s, 2, 1).ok);
});

test('bütün mahallelerde gelir aynı anda birikir', () => {
  const s = rich();
  s.level = 10;
  const k = G.build(s, 'kafe', AX + 1, 5).id;
  G0.openHood(s, 'sahil');
  const k2 = local('sahil').build(s, 'kafe', AX + 1, 5).id;
  G0.advance(s, 2 * G0.HOUR);
  assert.ok(s.buildings[k].stored > 70);
  assert.ok(s.buildings[k2].stored > 70);
});

test('eski kayıt (ayrı mahalle haritaları) tek haritaya taşınır', () => {
  const old = {
    v: 1, money: 1000, xp: 0, level: 10, gameTime: 0, speed: 1, savedAt: Date.now(), nextId: 4,
    parcels: ['1,1', '1,2'], parcelsPaid: 2500, hood: 'sahil', hoodsOpen: ['eski', 'sahil'],
    buildings: { b2: { id: 'b2', type: 'ev', x: 6, y: 9, paid: 300, paidIndex: 100, level: 1, contract: null, stored: 0 } },
    hoods: { eski: { buildings: { b1: { id: 'b1', type: 'ev', x: 6, y: 4, paid: 250, paidIndex: 100, level: 1, contract: null, stored: 0 } },
      parcels: ['1,1', '1,2'], parcelsPaid: 600, leftAt: 0 } },
    stats: { contractsSigned: 0, rentsCollected: 0, moneyEarned: 0 }, questIndex: 0, questDone: false,
  };
  const s = G0.deserialize(JSON.stringify(old));
  assert.equal(s.v, G0.SAVE_VERSION);
  assert.equal(s.hoods, undefined);
  assert.deepEqual([s.buildings.b1.x, s.buildings.b1.y], [18, 16], 'Eski Çarşı ortada');
  assert.deepEqual([s.buildings.b2.x, s.buildings.b2.y], [18, 33], 'Sahil güneyde');
  assert.ok(['4,4', '4,5', '4,7', '4,8'].every(k => s.parcels.includes(k)));
  assert.equal(s.parcelsPaid.eski, 600);
  assert.ok(G0.isConnected(s, s.buildings.b1) && G0.isConnected(s, s.buildings.b2), 'caddeler eski yerinde');
});

test('piyasa: memnun kiracılar endeksi yükseltir, boş evler düşürür', () => {
  const s = rich();
  const ids = [G.build(s, 'ev', AX + 1, 4).id, G.build(s, 'ev', AX + 1, 5).id];
  assert.ok(G.marketBreakdown(s).base < 100, 'boş evler düşürür');
  G.build(s, 'park', AX + 2, 4);
  for (const id of ids) {
    s.buildings[id].cards = [{ tenant: 'emekli', minutes: 720, demand: { kind: 'near', type: 'park' } }];
    G.signContract(s, id, 0);
  }
  assert.ok(G.marketBreakdown(s).base > 110, 'memnun kiracı + iyi yerleşim');
  s.market.nextEventAt = Infinity;
  G.advance(s, 12 * G.HOUR);
  assert.ok(G.marketIndex(s) > 105, 'endeks zamanla hedefe yaklaşır');
});

test('piyasa: endeks yükselince bina değerlenir, ucuzken alınan pahalıya satılır', () => {
  const s = rich();
  s.market.hoods.eski.index = 80;
  const cost80 = G.buildCost(s, 'villa');
  const id = G.build(s, 'villa', AX + 1, 5).id;
  assert.equal(s.buildings[id].paidIndex, 80);
  s.market.hoods.eski.index = 130;
  const v = G.sellValue(s, s.buildings[id]);
  assert.ok(v > cost80, 'kârla satış');
  const money = s.money;
  assert.equal(G.sell(s, id).refund, v);
  assert.equal(s.money, money + v);
});

test('piyasa olayı hedefi değiştirir ve süresi bitince kalkar', () => {
  const s = rich();
  s.market.nextEventAt = Infinity;
  const before = G.marketTarget(s);
  G.startRandomEvent(s, Math.random, 'eski', 'metro');
  assert.equal(G.marketTarget(s), before + 15);
  G.advance(s, 49 * G.HOUR);
  assert.equal(G.eventOf(s), null);
});

function rentCycle(s, id, rng = () => 0) {
  const h = s.buildings[id];
  G.advance(s, h.contract.minutes * G.MIN + 1);
  return G.collectRent(s, id, rng);
}

test('kiracı hikayesi: iki memnun yenilemeden sonra istek gelir, karşılanınca nadir süsleme açılır', () => {
  const s = rich();
  s.market.nextEventAt = Infinity;
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  G.build(s, 'park', AX + 2, 5);
  h.cards = [{ tenant: 'emekli', minutes: 480, demand: { kind: 'near', type: 'park' } }];
  G.signContract(s, id, 0);
  const noDrop = () => 0.99; // koleksiyon düşmesin, hikaye başlamasın
  rentCycle(s, id, noDrop);
  G.signContract(s, id, 'renew');
  rentCycle(s, id, () => 0.5); // 0.5 < storyChance: hikaye başlar (koleksiyon şansı 0.12 değil)
  assert.ok(h.story, 'hikaye başladı');
  assert.ok(['torun', 'anilar'].includes(G.storyOf(s, h).id), 'emeklinin hikayelerinden biri');
  h.story.id = 'torun'; // aşağıdaki adımlar parkla karşılanan hikayeyi dener
  assert.ok(G.storyMet(s, h), 'park zaten yakında');
  assert.equal(G.build(s, 'nadir-cinar', AX + 1, 6).ok, false, 'nadir süsleme kilitli');
  assert.ok(G.completeStory(s, id).ok);
  assert.ok(s.rareUnlocked.includes('nadir-cinar'));
  assert.ok(G.build(s, 'nadir-cinar', AX + 1, 6).ok);
});

test('ödemeli istek parayı düşer; süresi geçen istek kapanır', () => {
  const s = rich();
  s.market.nextEventAt = Infinity;
  const { id } = G.build(s, 'ev', AX + 1, 5);
  const h = s.buildings[id];
  h.tenure = { tenant: 'genc', renewals: 1 };
  h.contract = { tenant: 'genc', minutes: 60, demand: null, rent: 100, xp: 1, start: 0, end: 0 };
  h.story = { id: 'dugun', until: s.gameTime + 10 * G.HOUR };
  const m = s.money;
  assert.ok(G.completeStory(s, id).ok);
  assert.equal(s.money, m - 1500);
  h.story = { id: 'is', until: s.gameTime + G.HOUR };
  G.advance(s, 2 * G.HOUR);
  assert.equal(h.story, null);
});

test('günlük hedefler: günde 3 hedef, aynı gün aynı, ilerleme ve elmas ödülü', () => {
  const s = rich();
  const d1 = G.ensureDaily(s, '2026-11-23');
  assert.equal(d1.goals.length, 3);
  const ids = d1.goals.map(g => g.id).join();
  assert.equal(G.ensureDaily(s, '2026-11-23').goals.map(g => g.id).join(), ids, 'aynı gün değişmez');
  // her hedefi sayaçla tamamla
  for (const g of d1.goals) {
    const stat = { kira: 'rentsCollected', kontrat: 'contractsSigned', insa: 'built', gelir: 'incomeCollected', para: 'moneyEarned', yenile: 'renewals' }[g.id];
    assert.equal(G.claimDaily(s, d1.goals.indexOf(g)).ok, false);
    s.stats[stat] += g.n;
  }
  const dia = s.diamonds;
  assert.ok(G.claimDaily(s, 0).ok);
  assert.ok(G.claimDaily(s, 1).ok);
  const last = G.claimDaily(s, 2);
  assert.equal(last.bonus, 2);
  assert.equal(s.diamonds, dia + 3 + 2);
  assert.notEqual(G.ensureDaily(s, '2026-11-24'), d1, 'ertesi gün yeni hedefler');
});

function fresh(level = 20) {
  const s = G.createState();
  s.money = 1e7;
  s.level = level;
  s.market.nextEventAt = Infinity;
  return s;
}

test('üretim zinciri: orman odun üretir, kereste fabrikası odunu keresteye çevirir', () => {
  const s = fresh();
  const o1 = G.build(s, 'orman', AX + 1, 4).id;
  const o2 = G.build(s, 'orman', AX + 1, 5).id;
  const k = G.build(s, 'kereste', AX + 1, 6).id;
  assert.ok(o1 && o2 && k);
  G.advance(s, 10 * G.MIN);
  assert.ok(s.inv.kereste >= 8, `kereste: ${s.inv.kereste}`);
  assert.ok(s.inv.odun < 20, 'odun tüketildi');
});

test('girdi yoksa fabrika bekler, depo dolunca üretim durur', () => {
  const s = fresh();
  const k = G.build(s, 'kereste', AX + 1, 6).id;
  G.advance(s, 5 * G.MIN);
  assert.equal(G.producerStatus(s, s.buildings[k]), 'girdi');
  const o = G.build(s, 'orman', AX + 1, 4).id;
  s.inv.odun = G.depoCapacity(s);
  G.sell(s, k);
  G.advance(s, 5 * G.MIN);
  assert.equal(G.producerStatus(s, s.buildings[o]), 'dolu');
  assert.ok(G.upgradeDepo(s).ok);
  assert.equal(G.depoCapacity(s), 200);
});

test('mal pazarı: çok satınca fiyat düşer, zamanla toparlanır, alış satıştan pahalı', () => {
  const s = fresh();
  s.inv.celik = 100;
  const p0 = G.goodsSellPrice(s, 'celik');
  assert.ok(G.goodsBuyPrice(s, 'celik') > p0);
  const r = G.sellGoods(s, 'celik', 100);
  assert.ok(r.ok && r.total > 0 && r.total < p0 * 100);
  assert.ok(G.goodsSellPrice(s, 'celik') < p0);
  G.advance(s, 24 * G.HOUR);
  assert.ok(Math.abs(G.goodsSellPrice(s, 'celik') - p0) < 0.01);
});

test('malzemeli bina: eksik malzeme varsa kurulmaz, pazardan alınınca kurulur', () => {
  const s = fresh();
  const r = G.build(s, 'apartman', AX + 1, 5);
  assert.equal(r.ok, false);
  assert.ok(r.missing.kereste === 10 && r.missing.cimento === 8);
  const cost = G.missingCost(s, G.matsFor('apartman'));
  const m = s.money;
  assert.ok(G.buyMissing(s, G.matsFor('apartman')).ok);
  assert.equal(s.money, m - cost);
  assert.ok(G.build(s, 'apartman', AX + 1, 5).ok);
  assert.equal(s.inv.kereste, 0);
});

test('yükseltme: seviye artar, görünüm değişir, kira çarpanı artar', () => {
  const s = fresh();
  for (const k of Object.keys(s.inv)) s.inv[k] = 100;
  const id = G.build(s, 'ev', AX + 1, 5, () => 0.5).id;
  const h = s.buildings[id];
  assert.equal(G.spriteKey(h), 'ev-b', 'ortadaki görünüm');
  h.cards = [{ tenant: 'genc', minutes: 60, demand: null }];
  const r1 = G.quoteCard(s, h, h.cards[0]).rent;
  assert.ok(G.upgrade(s, id).ok);
  assert.equal(h.level, 2);
  assert.equal(G.spriteKey(h), 'ev-2');
  assert.ok(G.quoteCard(s, h, h.cards[0]).rent > r1 * 1.5);
  assert.ok(G.upgrade(s, id).ok);
  assert.equal(G.upgrade(s, id).ok, false, 'en çok 3. seviye');
});

test('özel yapı elmasla alınır; başarım ödülü verir', () => {
  const s = fresh();
  s.diamonds = 10;
  assert.equal(G.build(s, 'ozel-kule', AX + 1, 5).ok, false);
  s.diamonds = 100;
  assert.ok(G.build(s, 'ozel-kule', AX + 1, 5).ok);
  assert.equal(s.diamonds, 40);
  G.build(s, 'ev', AX + 1, 6);
  G.advance(s, G.MIN);
  assert.ok(s.achieved.includes('ilk-ev'));
  assert.ok(s.achieved.includes('ozel'));
});

test('test modu para, elmas ve malları bitirmez', () => {
  const s = G.createState();
  G.setTestMode(s, true);
  assert.ok(s.money >= 1e9 && s.diamonds >= 99999);
  s.money = 5; s.diamonds = 0; s.inv.celik = 0;
  G.applyTestMode(s);
  assert.ok(s.money >= 1e9 && s.diamonds >= 99999 && s.inv.celik >= 1000);
  G.setTestMode(s, false);
  s.money = 5; G.applyTestMode(s);
  assert.equal(s.money, 5);
  G.testSetLevel(s, 30);
  assert.equal(s.level, 30);
});

// ---------- 2. aşama ----------

test('mevsim: takvime göre, elle seçilebilir; mevsim süsü yalnız kendi mevsiminde kurulur', () => {
  const s = rich();
  assert.equal(G.currentSeason({}, new Date(2026, 0, 10)), 'kis');
  assert.equal(G.currentSeason({}, new Date(2026, 6, 10)), 'yaz');
  G.setSeasonOverride(s, 'yaz');
  assert.equal(G.season(), 'yaz');
  assert.equal(G.build(s, 'mevsim-kardan', AX + 1, 5).ok, false);
  G.setSeasonOverride(s, 'kis');
  assert.ok(G.build(s, 'mevsim-kardan', AX + 1, 5).ok);
  // kışın hamam daha çok kazanır
  const kis = G.incomePerHour('hamam');
  G.setSeasonOverride(s, 'yaz');
  assert.ok(kis > G.incomePerHour('hamam'));
  G.setSeasonOverride(s, null);
});

test('ilkbaharda süslemelerin etkisi artar', () => {
  const s = rich();
  G.setSeasonOverride(s, 'yaz');
  const { id } = G.build(s, 'ev', AX + 1, 5);
  G.build(s, 'dekor-cardak', AX + 2, 5);
  const yaz = G.bonusAt(s, AX + 1, 5).total;
  G.setSeasonOverride(s, 'ilkbahar');
  assert.ok(G.bonusAt(s, AX + 1, 5).total > yaz);
  G.setSeasonOverride(s, null);
  assert.ok(id);
});

test('geri dönüşüm tesisi ve işçi olumsuz etkiyi azaltır; konak Eski Çarşı bonusu alır', () => {
  const s = rich();
  G.setSeasonOverride(s, 'yaz');
  G.build(s, 'konak', AX + 1, 5);
  assert.ok(G.bonusAt(s, AX + 1, 5).parts.some(p => p.type === 'mahalle' && p.value === 15));
  G.build(s, 'atolye', AX + 2, 5);
  const once = G.bonusAt(s, AX + 1, 5).total;
  const isci = G.bonusAt(s, AX + 1, 5, 'isci').total;
  assert.ok(isci > G.bonusAt(s, AX + 1, 5, 'aile').total, 'işçi atölyeden az etkilenir');
  G.build(s, 'geri-donusum', AX + 1, 6);
  assert.ok(G.bonusAt(s, AX + 1, 5).total > once, 'tesis olumsuz etkiyi yarıya indirir');
  G.setSeasonOverride(s, null);
});

test('yalı yalnız deniz kıyısına kurulur; turist yalnız Sahilde gelir', () => {
  const s = rich();
  const r = G.build(s, 'yali', AX + 1, 5);
  assert.equal(r.ok, false);
  assert.match(r.msg, /deniz kenarına/);
  assert.ok(!G.availableTenants(s, 'ev').includes('turist'));
  assert.ok(G.availableTenants(s, 'ev').includes('isci'));
});

test('ziyaretçi gelir, isteği karşılanınca ödül verir', () => {
  const s = rich();
  s.market.nextEventAt = Infinity;
  for (let i = 0; i < 4; i++) G.build(s, ['kafe', 'market', 'berber', 'eczane'][i], AX + 1, 4 + i);
  G.advance(s, 2 * G.HOUR, () => 0); // ilk çağrıda ziyaretçi 1 saat sonraya planlanır
  G.advance(s, 2 * G.HOUR, () => 0); // rng 0: ilk tür (turist)
  assert.ok(s.visitor, 'ziyaretçi geldi');
  assert.equal(s.visitor.type, 'turist');
  assert.ok(G.visitorHere(s));
  const c = G.visitorCheck(s);
  assert.equal(c.have, 4);
  s.visitor.n = 4;
  const m = s.money;
  assert.ok(G.greetVisitor(s).ok);
  assert.ok(s.money > m);
  assert.equal(s.visitor, null);
  assert.equal(s.stats.visitorsHappy, 1);
  // isteği karşılanmayan ziyaretçi süre dolunca gider
  G.advance(s, 4 * G.HOUR, () => 0.99);
  assert.ok(s.visitor);
  s.visitor.n = 99;
  assert.equal(G.greetVisitor(s).ok, false);
  G.advance(s, 5 * G.HOUR, () => 0.99);
  assert.ok(!s.visitor || s.visitor.n !== 99);
});

test('haftalık hedefler: haftada 3 hedef, ilerleme ve elmas', () => {
  const s = rich();
  assert.equal(G.weekKey(new Date(2026, 10, 23)), '2026-W48');
  const w = G.ensureWeekly(s, '2026-W48');
  assert.equal(w.goals.length, 3);
  assert.equal(G.ensureWeekly(s, '2026-W48'), w);
  const g = w.goals[0];
  const stat = { kira: 'rentsCollected', kontrat: 'contractsSigned', insa: 'built', mal: 'goodsSold', hikaye: 'storiesDone', ziyaret: 'visitorsHappy' }[g.id];
  assert.equal(G.claimWeekly(s, 0).ok, false);
  s.stats[stat] += g.n;
  const d = s.diamonds;
  assert.ok(G.claimWeekly(s, 0).ok);
  assert.equal(s.diamonds, d + CONFIG.weeklyDiamonds);
});
