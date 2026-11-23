# Devam notları

Her çalışma oturumunda buraya tarihli not eklenir. Claude sohbetler arasında kodu hatırlamaz; bir sonraki oturum buradan başlar.

## 2026-11-23 — Prototip 0.1

**Yapılan**
- Tasarım dokümanı `docs/` klasörüne kondu.
- Tarayıcıda çalışan prototip yazıldı (kütüphane yok, düz HTML + JavaScript + Canvas). Phaser yerine düz Canvas seçildi: prototip için yeterli, indirme küçük, kurulum yok.
- Kapsam: README'deki "Prototipte olanlar" listesi.
- 14 kural testi (`npm test`), hepsi geçiyor. Telefon boyutunda tarayıcıda denendi: ev kurma, yol çizme, kiracı seçme, sürükleyerek toplama, yenileme çalışıyor.

**Prototipte verilen kararlar (dokümanda açık bırakılanlar)**
- Dil Türkçe, çalışma adı "Emlak Şehri".
- Görseller geçici: renkli kutular + emoji. Higgsfield görselleri 2. adımda.
- Dokümanda "3 bina kategorisi" yazıyordu; sanayi 4. kategori olarak eklendi, çünkü "park +, fabrika – ama yüksek gelirli" ikilemi etki alanı bulmacasının özü.
- Kira, kontrat imzalanırken o anki konum bonusuyla sabitlenir. Talep karşılanıyorsa toplarken +%15 eklenir.
- Memnuniyet: 60 taban, talep karşılanırsa +30, karşılanmazsa −10, sevmediği bina etkisindeyse −20, geç kalınan her saat −10.
- Memnuniyet ≥70 ise yenilemede imza ücreti alınmaz; 0 olursa kiracı gider (kira yine alınır).
- Binalar inşa süresi olmadan anında kurulur (elmas/hızlandırma 3. adımda).

**Sırada**
1. Kullanıcı telefonda oynayıp geri bildirim verecek: kira miktarları, süreler, fiyatlar hissi.
2. Geri bildirime göre `js/data.js` rakamlarını ayarlamak.
3. 2. adım: emlak piyasası (mahalle endeksi, al-sat), görsel tarz kararı, Sahil mahallesi.

## 2026-11-23 — Bina görseli sistemi

**Yapılan**
- `img/binalar/<tür>.png` varsa oyun kutu yerine o görseli çiziyor; yoksa kutu kalıyor. Görseller teker teker eklenebilir.
- Görsel kuralları ve dosya adları `img/binalar/OKU.md` içinde (izometrik açı, şeffaf arka plan, zemin baklavası görselin altına oturur).
- Deneme görseliyle telefonda denendi: bina kareye doğru oturuyor, bonus etiketleri ve balonlar görselin üstünde çıkıyor.

**Açık**
- Görsel tarzı kararı (çizgi film / low-poly / gerçekçi) kullanıcıda.
- Higgsfield bakiyesi 0,4 kredi; bir görsel 0,75 kredi. Higgsfield ile üretim için kredi gerekli.

## 2026-11-23 — Görsel tarz rehberi (taslak)

- Kullanıcı Millionaire City ekran görüntüleri gönderdi. Çıkan dersler `docs/Gorsel-Tarz-Rehberi.md` içinde: her bina kendi bahçesiyle, doygun sıcak renkler, tek bakışta tanınan işaret, ince dış çizgi.
- Kararlar (onay bekliyor): yarı gerçekçi elle boyanmış tarz, izometrik açı korunuyor, yerel Türk kasabası tonu, tabelalarda yazı yok.
- Rehberde 10 bina için tarif ve Higgsfield komut şablonu var.
- Sırada: kullanıcı Higgsfield'a kredi yükleyince ilk bina (müstakil ev) üretilip oyunda denenecek.

## 2026-11-23 — Kodla çizilen hareketler

**Yapılan** (`js/ambient.js`)
- Arabalar: ana caddeye bağlı yollarda dolaşır, sağ şeritten gider; harita kenarından çıkan başka kenardan girer. Sayısı yol ve dükkan sayısıyla artar (en çok 14).
- Yürüyen insanlar: kaldırımda yürür, arada geri döner. Sayısı kiracılı ev ve dükkan sayısıyla artar (en çok 18).
- Ağaçlar: kilitli arsalarda, rüzgârda sallanır. Arsa açılınca temizlenir.
- Duman: atölye bacasından, yalnız yola bağlıyken (çalıştığını gösterir).
- Parıltı: park çeşmesi ve villa havuzunda.
- Para saçılması: kira ya da gelir toplanınca bozuk paralar sıçrar.
- Menü → "Şehirde hareket" ile kapatılabilir; telefonda "hareketi azalt" ayarı açıksa varsayılan kapalı.
- Duman ve parıltı yerleri `js/data.js` içinde (`smoke`, `sparkle`); bina görselleri gelince bacanın yeri oradan ayarlanır.
- Telefon boyutunda saniyede 60 kare ölçüldü (test bilgisayarında).

**Sırada**
- Kare kare animasyon (neon, çeşme) altyapısı: hareketli görseller geldiğinde.
- Görseli olmayan binalar için tarayıcı konsolunda "dosya bulunamadı" uyarısı çıkıyor; zararsız.

## 2026-11-23 — İlk bina görseli: Müstakil Ev

- Kullanıcı Higgsfield sitesinde sınırsız hakla (GPT Image 2.6) müstakil evi üretti. Kaynak: `img/kaynak/ev.webp`.
- Higgsfield'ın sınırsız hakkı bağlantı (MCP) üzerinden görünmüyor; Claude üretirse 1000 krediden düşer. Kullanıcı kredi harcamayı onaylamadı. Şimdilik yol: kullanıcı sitede üretir, Claude hazırlar.
- `tools/gorsel_hazirla.py` yazıldı: siyah arka planı siler, kırpar, gerçek izometrik açıyı (1,73) oyunun 2:1 karesine uydurur (dikeyde %13 basma), 512 px'e küçültür.
- Oyunda denendi (telefon boyutu): bahçe kareyi dolduruyor, balonlar evin üstünde.
- Bu ev, diğer binalar üretilirken örnek görsel olarak verilecek.
