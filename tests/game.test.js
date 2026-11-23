import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { CONFIG, BUILDINGS } from '../js/data.js';

const AX = CONFIG.avenueX; // ana cadde sütunu (başlangıç parseli 4..7 içinde)

function rich() {
  const s = G.createState();
  s.money = 1e7;
  s.level = 20;
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

test('nehre bina ve yol yapılamaz; nehir kenarındaki ev ve tepedeki ev bonus alır', () => {
  const s = rich();
  G.buyParcel(s, 1, 2);
  assert.equal(G.terrainAt(6, 10), 'nehir');
  assert.equal(G.build(s, 'ev', 6, 10).ok, false);
  assert.equal(G.build(s, 'yol', 7, 10).ok, false);
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

test('mahalle: seviye ve para ister, açılınca geçilir, binalar mahallede kalır', () => {
  const s = rich();
  s.level = 5;
  assert.equal(G.openHood(s, 'sahil').ok, false, 'seviye 8 gerekli');
  s.level = 8;
  const evId = G.build(s, 'ev', AX + 1, 5).id;
  assert.ok(G.openHood(s, 'sahil').ok);
  const worthBefore = G.netWorth(s);
  assert.ok(G.switchHood(s, 'sahil').ok);
  assert.equal(Object.keys(s.buildings).length, 0, 'Sahil boş başlar');
  assert.equal(G.netWorth(s), worthBefore, 'net değer bütün mahalleleri sayar');
  G.build(s, 'ev', AX + 1, 5);
  assert.ok(G.switchHood(s, 'eski').ok);
  assert.ok(s.buildings[evId], 'Eski Çarşı binası yerinde');
  assert.equal(Object.keys(s.buildings).length, 1);
});

test('Sahil: denize bina yapılamaz, deniz manzarası bonusu, cadde kumsalda biter', () => {
  const s = rich();
  s.level = 8;
  G.openHood(s, 'sahil');
  G.switchHood(s, 'sahil');
  G.buyParcel(s, 1, 2);
  assert.equal(G.build(s, 'ev', 6, 11).ok, false, 'deniz');
  assert.equal(G.build(s, 'ev', 6, 10).ok, false, 'kıyı');
  assert.ok(G.build(s, 'ev', 6, 9).ok, 'kum');
  assert.equal(G.bonusAt(s, 6, 9).total, 15);
  assert.equal(G.isAvenue(5, 10), false);
  G.switchHood(s, 'eski');
  assert.equal(G.isAvenue(5, 10), true, 'Eski Çarşı caddesi boydan boya');
});

test('Sanayi Bölgesi: kirlilik etkiyi genişletir, sanayi geliri artar', () => {
  const s = rich();
  s.level = 20;
  G.build(s, 'atolye', 7, 4);
  assert.equal(G.bonusAt(s, 7, 7).total, 0, 'Eski Çarşıda 3 kare uzak etkilenmez');
  G.openHood(s, 'sanayi');
  G.switchHood(s, 'sanayi');
  G.build(s, 'atolye', 7, 4);
  assert.ok(G.bonusAt(s, 7, 7).total < 0, 'kirlilikle etkilenir');
  assert.ok(G.incomePerHour('atolye') > 220);
});

test('İş Merkezi: yüksek bina yanındaki eve gölge', () => {
  const s = rich();
  s.level = 30;
  G.openHood(s, 'is');
  G.switchHood(s, 'is');
  G.build(s, 'gokdelen', 7, 4);
  const near = G.bonusAt(s, 7, 5).parts.find(p => p.type === 'golge');
  assert.equal(near.value, -10);
});

test('Tepe Villaları: her kare tepe, ünlü her eve, arsa sınırlı', () => {
  const s = rich();
  s.level = 30;
  G.openHood(s, 'tepe');
  G.switchHood(s, 'tepe');
  assert.equal(G.terrainAt(6, 6), 'tepe');
  assert.ok(G.availableTenants(s, 'ev').includes('unlu'));
  assert.equal(G.buyParcel(s, 0, 0).ok, false);
  assert.ok(G.buyParcel(s, 2, 1).ok);
});

test('geri dönünce yokken biriken ticari gelir eklenir', () => {
  const s = rich();
  s.level = 10;
  const k = G.build(s, 'kafe', AX + 1, 5).id;
  G.openHood(s, 'sahil');
  G.switchHood(s, 'sahil');
  G.advance(s, 2 * G.HOUR);
  G.switchHood(s, 'eski');
  assert.ok(s.buildings[k].stored > 70);
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
  assert.equal(G.storyOf(s, h).id, 'torun');
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
