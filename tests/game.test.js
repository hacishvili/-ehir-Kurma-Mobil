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
