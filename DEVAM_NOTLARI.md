# Devam notları

Her çalışma oturumunda buraya tarihli not eklenir. Claude sohbetler arasında kodu hatırlamaz; bir sonraki oturum buradan başlar.

**Çalışma kuralı:** APK yalnız kullanıcı "APK oluştur" deyince derlenir ve gönderilir. Değişiklikler commit/push edilir, tarayıcı önizlemesi güncellenir; APK kendiliğinden yapılmaz.

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

## 2026-11-23 — Kafe ve Park görselleri

- Kullanıcı kafe ve parkı üretti (kaynaklar `img/kaynak/`). Hazırlanıp oyuna kondu.
- `tools/gorsel_hazirla.py` artık açı oranını zeminin alt kenar eğiminden ölçüyor (ağaç ve çitten etkilenmiyor). Ölçülen oranlar: ev 1,83, park 1,73, kafe 1,85. Üç görsel yeniden işlendi.
- Park, ev ve kafeden biraz daha çizgi filmsi (kalın siyah dış çizgi). Küçük boyutta göze batmıyor; diğer binalarda ev ve kafe örnek gösterilmeli.

## 2026-11-23 — Higgsfield görsellerine doğrudan erişim

- Ortamın izin listesine `d8j0ntlcm91z4.cloudfront.net` eklendi (kullanıcı onayıyla). Claude, kullanıcının Higgsfield'da ürettiği görselleri listeleyip (show_generations) orijinal PNG'yi indirebiliyor. Kullanıcının görsel yüklemesine gerek yok.
- Ev, kafe ve park kaynakları sıkıştırılmış webp yerine orijinal PNG ile değiştirildi ve yeniden işlendi.
- Not: kullanıcının üretimleri Nano Banana modeliyle; kafe ve parkta referans görsel eklenmemişti.

## 2026-11-23 — Market, Apartman, Atölye görselleri

- Claude, Higgsfield geçmişinden üç görseli indirip hazırladı ve oyuna koydu. 10 binanın 6'sının görseli var: ev, kafe, park, market, apartman, atölye.
- Atölye dumanı artık görseldeki bacanın tepesinden çıkıyor (`js/data.js` → `smoke`).
- Gözlem: bu üç görselde de referans görsel eklenmemiş; market ve atölye ev/kafeden daha çizgi filmsi (kalın çizgi, marketteki elmanın yüzü var). Atölye binası bahçesine göre küçük kalıyor.
- Kalan: villa, gece kulübü, okul, metro durağı.

## 2026-11-23 — Son dört bina: Villa, Gece Kulübü, Okul, Metro

- 10 binanın 10'unun da görseli var. Kaynaklar `img/kaynak/`, oyundakiler `img/binalar/`.
- Parıltı yerleri görsellere göre ayarlandı: villa havuzu, park çeşmesi (`js/data.js` → `sparkle`, `js/ambient.js` artık x/y kaymasını okuyor).
- Telefon boyutunda bütün binalarla şehir denendi, hata yok.
- Bu dört görselde de referans görsel eklenmemişti; tarz yine de birbirine yakın.

## 2026-11-23 — Bütün görsel komutları (PDF)

- Kullanıcı kararı: önce dokümandaki her şey eklenecek, denge ayarı sonra.
- `docs/Gorsel-Komutlari.pdf`: 37 görsel için komut, oran ve dosya adı. Bölümler: 9 yeni bina (AVM, fabrika, stadyum 2×2), 2 yenileme (atölye, market), 6 zemin (kum, deniz, kıyı, nehir, tepe, beton), 6 süsleme, 6 kiracı portresi, danışman, 3 simge + 3 koleksiyon parçası, uygulama ikonu.
- Kullanıcı numarayla "hazır" diyecek; Claude Higgsfield geçmişinden komut metnine göre bulup indirecek.
- Kodda gereken yeni işler: 2×2 bina desteği, zemin kareleri, süslemeler, kiracı portreleri, yeni kiracılar (sanatçı, ünlü), mahalleler, emlak piyasası, elmas, koleksiyon, kiracı hikayeleri, günlük hedefler.

## 2026-11-23 — Görsel listesi 1–14: yeni binalar, 2×2 binalar, zeminler

- Dokuz yeni bina oyunda: rezidans, banka, AVM (2×2), fabrika (2×2), lojistik depo, hastane, saat kulesi, stadyum (2×2), gökdelen. Rakamlar `js/data.js` içinde, ilk tahmin.
- Yeni kategori: Simge yapı (saat kulesi, stadyum, gökdelen).
- Büyük bina desteği: `size: 2`. Bina dört kare kaplar; yol bağlantısı ve etki alanı binanın kenarından ölçülür; yerleştirme, taşıma, çizim, duman hepsi buna göre. 3 yeni test (toplam 17).
- Atölye ve market yeniden üretilmiş görsellerle değişti. Atölye ve fabrika dumanı bacalardan çıkıyor (fabrikada iki baca).
- Görsel aracı: arka plan rengini kenarların çoğunluğundan buluyor (bankanın köşesinde gri leke vardı), yalnız en büyük parçayı bırakıyor, `img/kaynak/ayarlar.json` ile görsele özel ayar (market: tolerans 40).
- Zemin kareleri (kum, deniz, kıyı) hazırlandı (`img/binalar/zemin-*.png`) ama henüz kullanılmıyor; Sahil mahallesiyle gelecek.

## 2026-11-23 — Görsel 15–17: nehir, tepe, beton; arazi özellikleri

- Dokümandaki "bazı parsellerde nehir, tepe gibi özellikler olur ve kendi etki alanlarını taşır" kuralı yapıldı (`js/data.js` → `TERRAIN`, `MAP_TERRAIN`).
- Nehir: y=10 satırı boyunca akar, ana cadde köprüyle geçer. Üstüne bina ve yol yapılamaz. 1 kare yakınındaki evlere +%8 (nehir manzarası).
- Tepe: kuzeydoğu parselinde 4 kare. Üstüne bina yapılabilir; tepedeki eve +%10.
- Zemin kareleri görselle çiziliyor; kilitli arsada koyulaştırılıyor; ağaçlar nehre çıkmıyor. 1 yeni test (toplam 18).
- Beton, kum, deniz, kıyı kareleri hazır ama kullanılmıyor: Sanayi Bölgesi / İş Merkezi / Sahil mahalleleriyle gelecek.

## 2026-11-23 — Görsel 18–37 (Claude üretti) ve yeni sistemler

- Kullanıcı "geri kalanı sen hallet" dedi; kalan 20 görseli Claude Higgsfield'da Nano Banana ile üretti (20 kredi). Süslemelerde ev ve kafe referans görsel olarak verildi.
- `tools/gorsel_hazirla.py --ikon`: simge ve portreler için (açı düzeltmesi yok, `img/ui/` altına). `--arkaplan-kalsin` uygulama ikonu için. Harita ve tapu ikonlarında tolerans 60 (`img/kaynak/ayarlar.json`).
- Yeni: Süsleme kategorisi (6 süsleme, ucuz, küçük etki alanı). Çeşmede parıltı.
- Yeni kiracılar: Sanatçı (seviye 4; kafe, atölye, heykel sever; AVM sevmez), Ünlü (seviye 9; yalnız villa ve rezidans; 3 kat kira; sanayi ve stadyum sevmez). Sanatçının "mahalle endeksini yükseltme" özelliği emlak piyasasıyla gelecek.
- Kiracı portreleri: kartlarda, ev panelinde ve haritadaki balonlarda.
- Elmas: başlangıç 5, her seviye +2. "Hemen bitir": kalan her saat için 1 elmas.
- Koleksiyon: kira toplarken %12 şansla tapu/anahtar/harita düşer; üçü birden → set → kiraya kalıcı +%2 (en çok 10 set). Menü → Koleksiyon.
- Danışman görseli görev şeridinde ve hoş geldin penceresinde. Uygulama ikonu sekme simgesi.
- Üst gösterge dar ekrana sığdırıldı; büyük sayılar kısaltılıyor (992,2 B). İnşa menüsünde bina görselleri.
- 4 yeni test (toplam 22).

**Sırada (dokümandan kalanlar)**
- Mahalleler: Sahil (kum/deniz/kıyı zeminleri hazır), Sanayi Bölgesi, İş Merkezi (beton hazır), Tepe Villaları.
- Emlak piyasası: mahalle endeksi, al-sat, haftalık olaylar, sanatçı etkisi.
- Kiracı hikayeleri, günlük hedefler, ses.
- Sonra: denge ayarı (kullanıcı oynayınca), Android paketleme, sosyal özellikler.

## 2026-11-23 — Mahalleler

- Dört yeni mahalle (`js/data.js` → `HOODS`): Sahil (seviye 8, 15.000), Sanayi Bölgesi (15, 60.000), İş Merkezi (22, 200.000), Tepe Villaları (30, 600.000).
- Para, seviye, elmas, koleksiyon ortak; her mahallenin binaları, arsaları ve arsa fiyatı ayrı. Görüntülenmeyen mahalle `s.hoods` içinde saklanır, geçişte yer değiştirir. Ticari gelir geri dönüldüğünde aradaki süre için eklenir; kontratlar zamana bağlı olduğu için zaten işler.
- Kurallar: Sahil'de deniz ve kıyıya bina yapılamaz, denize 2 kare yakın eve +%15, cadde kumsalda biter. Sanayi'de olumsuz etkiler 1 kare geniş, sanayi geliri +%25, zemin beton. İş Merkezi'nde gökdelen/rezidans/saat kulesi yanındaki eve -%10 gölge, zemin beton. Tepe'de her kare tepe (+%10), ünlü her eve gelir, yalnız 4 parsel satılık.
- Alt menüye Mahalle düğmesi; mahalle listesi açma/geçme. Görevlere "Seviye 8" ve "Sahil'i aç" eklendi. Denizde parıltı.
- Kayıt uyumu: eski kayıtlar Eski Çarşı'da açılır. 6 yeni test (toplam 28).
- Not: `game.js` görüntülenen mahalleyi modül düzeyinde tutar (`setActiveHood`); tek oyun durumu olduğu için sorun değil.

## 2026-11-23 — Emlak piyasası

- Her açık mahallenin %70–140 arası endeksi var (`s.market`). Endeks hedefe yavaşça yaklaşır (saatte farkın ~%15'i).
- Hedef = 100 + memnun kiracı oranı ×20 − boş ev oranı ×10 + ortalama konum bonusu ×0,5 (−10..+15) + kiracılı sanatçı ×3 (en çok +15) + olay etkisi. Rakamlar `CONFIG.market`.
- Olaylar (`MARKET_EVENTS`): 24 oyun saatinde bir, açık bir mahallede 24–48 saatlik olay (metro +15, turizm +14 Sahil'de, durgunluk −12, sel −10 Eski Çarşı'da ...). Haber olarak bildirilir.
- Al-sat: bina ve arsa fiyatı endeksle çarpılır. Bina alındığı endeksi saklar (`paidIndex`); piyasa değeri = ödenen × şimdiki endeks / alıştaki endeks; satış = değerin %80'i. Ucuzken kurup değerlenince satmak kâr getirir.
- Net değer artık binaların satış değeri + arsalar (endeksle).
- Ekran: Mahalle menüsünün başında piyasa kartı (endeks, yön, grafik, bileşenler, olay); her mahallenin yanında endeksi; bina panelinde piyasa değeri ve alış; İnşa menüsünde endeks notu.
- 3 yeni test (toplam 31).

## 2026-11-23 — Kiracı hikayeleri

- Aynı kiracı memnun kalıp kontratını yenileyince (ikinci memnun toplamada, %60 şansla) özel bir istek getirir (`STORIES`, `js/data.js`). 48 oyun saati süre.
- İstek türleri: yakında belirli bina (near), para desteği (pay), konum bonusu en az % (bonus). 7 hikaye: evlilik, iş kurma, bebek, torunlar, sergi, mezuniyet, basın toplantısı.
- Ödül: nadir süsleme açılır (+ elmas/para), kiracının memnuniyeti kalıcı +15. Kiracı ayrılırsa hikaye kapanır.
- 4 nadir süsleme (Claude üretti, 4 kredi): Asırlık Çınar, Nilüferli Havuz, Antika Sokak Saati, Gül Bahçesi. Yalnız hikayeyle açılır (`rare: true`, `s.rareUnlocked`); İnşa menüsünde "📜 Hikayeyle açılır".
- Ekran: haritada evin yanında 📜 balonu, ev panelinde istek kartı, açılınca kutlama penceresi, Nasıl oynanır'a madde. 2 yeni test (toplam 33).

## 2026-11-23 — Günlük hedefler ve ses

- Günlük hedefler (`DAILY_GOALS`): cihazın takvim gününe göre 3 hedef (aynı gün hep aynı; tarih karışımıyla seçilir). Hedefler sayaçlardan ilerler: kira topla, kontrat imzala, bina kur, dükkan geliri topla, para kazan, kontrat yenile. Her biri 1 elmas, üçü birden +2. Üstte 🎯 düğmesi, alınacak varsa sarı yanıp söner.
- Yeni sayaçlar: `stats.built`, `stats.incomeCollected`, `stats.renewals`.
- Hata düzeltmesi: 'built' olayında `type` alanı olay adını eziyordu; artık `buildingType`.
- Ses (`js/audio.js`): Web Audio ile üretilen efektler (para, inşaat, kontrat, seviye, ödül çanı, haber, hata, dokunma) ve sakin döngüsel müzik (C–Am–F–G, yumuşak akor + pentatonik melodi). İlk dokunuşta açılır; sekme arka plandayken susar. Menü → Ses: efektler ve müzik ayrı ayrı açılıp kapanır (cihaz ayarı).
- Sesler test ortamında hatasız çalıştı ama kulakla dinlenmedi; kullanıcı telefonda dinleyip söyleyecek.
- 1 yeni test (toplam 34).

## 2026-11-23 — Android paketi ve Google Play hazırlığı

- Oturum "Mobil-Game" ortamına geçirildi (kullanıcı onayıyla): dl.google.com, Maven ve Gradle erişimi var.
- Capacitor 8.6.2 ile `android/` projesi. Paket adı `com.emlaksehri.oyun`, sürüm 0.1.0 (versionCode 1), hedef SDK 36, en düşük 24.
- `scripts/web-paketle.mjs` → `www/` (img/kaynak pakete girmez). `npm run android` = paketle + cap sync.
- `tools/android_ikon.py`: uygulama ikonundan Android ikonları (kare, yuvarlak, uyarlanabilir) ve açılış ekranı.
- Maven 429 hatası: `org.gradle.parallel=false` ve `--max-workers=1` ile çözüldü.
- Yükleme anahtarı (upload key) üretildi: `~/imza/emlak-sehri-yukleme.jks`, alias `yukleme`. Şifresi `android/keystore.properties` içinde; ikisi de git'e girmez. Kullanıcıya dosya olarak verildi; Play Uygulama İmzalama açık kalmalı.
- Çıktılar: imzalı AAB (15,5 MB) ve APK. İmza `apksigner` ile doğrulandı. Gerçek cihazda henüz denenmedi.
- `docs/Google-Play.md`: adım adım yükleme, mağaza metinleri, veri güvenliği ve içerik derecelendirme cevapları. `docs/gizlilik-politikasi.html`. `docs/play/`: 512 ikon, 1024×500 öne çıkan görsel, 4 telefon ekran görüntüsü (1080×1920).

## 2026-11-23 — Faz 1 çeşitlilik + Sanayi Baronu'nun sanayileşme sistemi

Kullanıcı isteği: çeşitlilik az; seviyeyle değişen binalar, farklı yollar/köprüler/ağaçlar, elmasla alınan özel yapılar, daha çok bina, tekrar eden oynanış. Ek olarak `hacishvili/Mobil-Game` deposunun `claude/mobile-game-dev-j7t2fl` dalındaki **Sanayi Baronu** (Flutter) oyununun sanayileşme sistemi entegre edildi.

**Görseller (Claude üretti, 42 kredi):** 10 yükseltme görünümü (ev/apartman/villa/kafe/market seviye 2-3), 4 farklı görünüm (ev-b, ev-c, apartman-b, apartman-c), 7 yeni bina (eczane, cami, hamam, spor, otel, çay bahçesi, kütüphane), 4 ağaç, 3 elmaslı özel yapı (Gökyüzü Kulesi, Dönme Dolap 2×2, Saray 2×2), 14 üretim binası. Eczane için tolerans 40.

**Sanayileşme (`RESOURCES`, `INDUSTRY`, `MATS` — `js/data.js`; mantık `js/game.js`):**
- 14 mal (Sanayi Baronu ile aynı zincir, fiyatlar bizim ekonomiye ölçeklendi): odun, kum, buğday, kömür, demir, petrol → kereste, un, çimento, cam, çelik, plastik → ekmek, mobilya.
- Üretim binaları haritaya kurulur (`cat: 'hammadde' | 'isleme'`, `produce: {inputs, outputs, minutes}`). Yola bağlı olmalı; çoğu çevresine olumsuz etki. Sanayi Bölgesi'nde %25 hızlı. Önce hammadde sonra işleme sırasıyla işler; uzun aradan sonra en çok 8 saatlik üretim.
- Depo: her maldan 100 adet (seviye başına ×2, büyütme 1500×3^seviye). Dolunca üretim durur; girdi yoksa fabrika bekler.
- Mal pazarı: satınca fiyat düşer (baskı), ~3 oyun saatinde toparlanır; alış %10 pahalı (Sanayi Baronu market.dart mantığı).
- Büyük binalar para + malzeme ister (`MATS`). Eksik malzeme tek dokunuşla pazardan alınabilir.

**Yükseltme (`UPGRADES`):** ev, apartman, villa, kafe, market 3 seviye; seviye 2 kereste/çimento/cam, seviye 3 çelik/cam/mobilya (kafe/market ekmek de ister). Kira/gelir ×1,6–1,7 ve ×2,5–2,6. Görünüm `<tür>-<seviye>.png`. Haritada ★ işareti.
**Görünümler (`VARIANTS`):** ev ve apartman kurulurken rastgele 3 görünümden biri.
**Yollar:** Asfalt (bedava), Arnavut kaldırımı (20, sv3, küçük bonus), Ağaçlı bulvar (60, sv6). Nehrin üstüne yol = köprü.
**Özel yapılar:** elmasla (`diamondCost`): kule 60, dönme dolap 40 (gelir de verir), saray 80.
**Başarımlar (`ACHIEVEMENTS`):** 15 başarım, kendiliğinden verilir (elmas/para); Menü'de liste.
**Ekran:** alt menüde 📦 Depo (6 düğme), fabrika panelinde üretim hızı/durum, yükseltme kartı, eksik malzeme penceresi, yol türü seçici, İnşa menüsünde Hammadde ve Sanayi Üretimi bölümleri.
- 6 yeni test (toplam 40). Eski testlerde `rich()` artık depoyu doldurur; nehre yol testi köprü olarak güncellendi.

**Kalan (faz 1'den):** ziyaretçiler (turist, müfettiş, gazeteci) yapılmadı. Faz 2: kalan binalar, yeni kiracılar, 20 hikaye, mevsimler.

## 2026-11-23 — Test modu
Menü → 🧪 Test modu: açıkken para 1 milyar, elmas 99.999, her mal en az 1000 adet tutulur (depo en az 8. seviye). Seviye 10/20/30 düğmeleri seviyeyi doğrudan ayarlar (`G.testSetLevel`). Kapatınca normal ekonomi döner; kazanılan para kalır. Sürüm 0.2.1 (kod 3).

## 2026-11-23 — Doğal zemin, haritanın çevresi, ağaç görselleri
Kullanıcı: harita ekran boyunda olsun, kaydırınca mavi arka plan görünmesin, zemin ve ağaçlar daha doğal olsun.
- Görseller (Claude, 10 kredi): `img/doga/` — zemin dokuları `cim.jpg` (açık arsa) ve `yabani.jpg` (kilitli arsa ve harita dışı çayır); tek başına ağaçlar: meşe, köknar, kavak, yapraklı ağaç, iki çam, çalı, kaya, çiçek. Kaynaklar `img/kaynak/doga/`, işleme `tools/doga_hazirla.py` (dokuyu dikişsiz yapar ve büyük lekeleri düzler; ağaçların gölgesini siler, gölgeyi oyun çizer).
- `js/render.js`: gökyüzü yok; ekran yabani çayır dokusuyla dolar (doku izometrik zemine yatırılmış desen). Açık arsalar tek parça çim dokusu (kare çizgisi yok). Izgara yalnız inşa ederken/yol yaparken (`view.grid`). Harita dışında 12 karelik kuşakta kenardan uzaklaştıkça sıklaşan orman; deniz, nehir, kum ve ana cadde haritanın dışına uzanır. Deniz kodla üretilen tek parça dokuyla çizilir (kare kare şeritlenmiyordu).
- Ağaçlar artık görsel (kodla çizilen yuvarlak ağaçlar `ambient.js`ten kaldırıldı). Kilitli arsadaki ağaçlar rüzgârda sallanır (hareket açıksa).
- Hız: harita dışı sabit olduğu için ekrandan biraz büyük ara belleğe bir kez çizilir, kaydırırken yalnız kopyalanır; yakınlaşma bitince ya da kenara gelince yeniden çizilir. Telefon boyutunda 60 kare/sn (ara bellek olmadan 17'ydi).
- Yakınlık: açılışta harita ekrana sığar; bundan daha fazla uzaklaşılamaz (`fitZoom`). Kaydırma haritanın taştığı kadar + biraz pay.
- Sürüm 0.2.2 (sürüm kodu 4).

## 2026-11-23 — 2. aşama: içerik, ziyaretçiler, haftalık hedefler, mevsimler
Görseller (Claude, ~50 kredi): kaynaklar `img/kaynak/`, doğa ve mevsim ağaçları `img/kaynak/doga/`.
- **Yeni binalar (28):** konut konak, çiftlik evi, işçi lojmanı, yalı; ticari berber, lokanta, butik, sinema; kamu postane, karakol, itfaiye; sanayi geri dönüşüm tesisi, güneş santrali; simge deniz feneri, müze, kültür merkezi; süs servi, söğüt, bayrak, çardak, otobüs durağı, bisiklet parkı, sebil; mevsim süsleri kardan adam, yılbaşı ağacı (kış), lale bahçesi (ilkbahar), dondurma arabası (yaz), hasat köşesi (sonbahar). Toplam 88 bina.
- **Yeni kurallar (`js/data.js` alanları, uygulaması `bonusAt`/`canPlace`/`build`):** `hoodBonus` (konak Eski Çarşı'da +%15, çiftlik Tepe'de +%20, lojman Sanayi'de +%20); `resist` (lojman olumsuz etkinin yarısını hisseder); `needsNear` (yalı ve deniz feneri yalnız deniz kenarına); `cleanse` (geri dönüşüm tesisi 2 kare içindeki olumsuz etkiyi yarıya indirir); `season` (mevsim süsü yalnız kendi mevsiminde kurulur).
- **Rezidans yükseltmesi** (seviye 2-3 görselleri) ve **villa için 2 yeni görünüm**.
- **Kiracılar (10):** işçi (Sanayi ve Eski Çarşı, olumsuz etkiyi az hisseder), girişimci, doktor, turist (yalnız Sahil, kısa ve pahalı). Portreler `img/ui/kiraci-*.png`.
- **Hikayeler: 20** (13 yeni). Hikaye artık yalnız istenen binalardan en az biri açılmışsa başlar.
- **Ziyaretçiler** (`VISITORS`; `visitorTick/visitorCheck/greetVisitor`): 3. seviyeden sonra ara sıra turist, belediye müfettişi ya da gazeteci bir binanın üstünde belirir (portre balonu). İstek: farklı dükkan/simge sayısı, memnun kiracı oranı, ya da yüksek konum bonuslu ev. Ödül para/elmas/XP; gazeteci mahalle endeksini 1 gün +10 yapar (`MARKET_EVENTS` içinde `haber`). 4 oyun saati bekler.
- **Haftalık hedefler** (`WEEKLY_GOALS`, ISO hafta): 3 büyük hedef, her biri 4 elmas, üçü +8. Günlük hedefler penceresinin altında.
- **Mevsimler** (`SEASONS`): gerçek takvime göre (Menü'den test için seçilebilir). Kış: kar zemin, karlı çam, çıplak ağaçlar, donmuş nehir kıyısı, kar yağışı; hamam/kafe geliri artar, sahil kirası -%10. Sonbahar: sararmış çayır, turuncu ağaçlar, düşen yapraklar; kafe/sinema/market geliri artar. İlkbahar: süslemelerin etkisi +%30, uçuşan çiçek yaprakları. Yaz: sahil kirası +%20, otel/lokanta/güneş santrali geliri artar. Üst göstergede mevsim düğmesi.
- Testler: 47 (6 yeni).

**Sıradaki fikirler:** mahalle festivalleri (kısa süreli ödüllü olaylar), yeni konutların yükseltme seviyeleri, bina görsellerinin WebP'ye çevrilmesi (APK boyutu).

## 2026-11-23 — Tek büyük harita (0.4.0)
- **Ağaçlar küçüldü:** evlerin yarısı boyunda (`TREE_SCALE` 0.5, `js/render.js`). Kilitli arsalarda ağaç yok, yalnız çalı ve çiçek: arsa görünür, dokunması kolay. Harita dışında ağaç sıklığı arttı.
- **Mahalleler artık ayrı harita değil, tek 36×36 haritanın bölgeleri** (`HOODS[id].area` parsel aralığı, `start` ilk parsel). Yerleşim: Tepe kuzeybatı, İş Merkezi kuzey, Sanayi doğu (6 parsel boyu), Eski Çarşı orta (6×3 parsel), Sahil bütün güney şeridi. Üç ana cadde (x=5, 17, 29) kuzeyden kumsala; nehir y=22'de haritayı keser (caddeler köprüyle geçer); y=32-33 kum, 34 kıyı, 35 deniz (`AVENUES`, `WORLD_TERRAIN`).
- Mahalle kuralları kareye göre işler (`hoodAt(x, y)`): kirlilik, gölge, tepe kiracısı, mahalle konut bonusu, sanayi geliri/üretim hızı, bina ve arsa fiyatı (o mahallenin endeksi), satış değeri. Her mahallenin endeksi kendi evlerine göre hesaplanır. Bütün binalar aynı anda gelir üretir (mahalle geçişi yok).
- Mahalle açmak ilk parselini verir. Arsa fiyatı her mahallede ayrı artar; kapalı mahallenin parseli alınamaz. Kapalı mahalle haritada koyu ve ortasında ad + seviye/fiyat etiketiyle görünür; dokununca Mahalleler penceresi açılır. Fiyat etiketi yalnız açık arsaya komşu parsellerde.
- Mahalleler penceresinde "Gör" kamerayı o mahalleye götürür. Üst göstergedeki mahalle adı ekranın ortasındaki mahalle (`s.hood` artık yalnız bu; inşa menüsündeki fiyat da buna göre).
- **Eski kayıt taşıma** (`migrateToWorld`, kayıt sürümü 1 → 2): her mahallenin 12×12 haritası `HOODS[id].origin` noktasına konur. Caddeler eski yerlerine denk geldiği için binalar bağlı kalır; yine de yerleşemeyen olursa parası iade edilir ve oyuncuya bildirilir.
- Çizim: yalnız ekrandaki kareler çizilir. Telefon boyutunda kaydırırken 53-60 kare/sn.
- Testler: 49. Eski testler `local(id)` sarmalayıcısıyla mahallenin kendi koordinatlarında çalışır.
- Sürüm 0.4.0 (sürüm kodu 6).

## 2026-11-23 — Ağaç ve yol görselleri (0.4.1, 0.4.2)
- **Ağaçlar** (0.4.1): oyuncunun ürettiği 13 doğa görseli `img/kaynak/doga/` altında; `tools/doga_hazirla.py` arka planı ve gölgeyi silip `img/doga/` içine yazar. Sonbahar meşesi gelmedi, eskisi duruyor.
- **Yol görselleri** (0.4.2): Asfalt Yol ve Arnavut Kaldırımı artık görselle çizilir. Yapay zekâ her parçayı (dönemeç, T, dört yol, çıkmaz) ayrı çizince yol genişliği parçadan parçaya %18-41 arası değişti, yan yana oturmadı. Bu yüzden `tools/yol_hazirla.py` yalnız düz yol görselinden (`img/kaynak/yollar/<tür>-duz.png`) 16 parçayı hesaplar: `img/yollar/<tür>-<n>.png`, n = kuzey 1 + doğu 2 + güney 4 + batı 8. Bant karenin %60'ı (`BAND`), kenar taşı aynen kalır, yol yüzeyi aynalanarak genişletilir; dönemeç çeyrek halka.
- Oyunda (`roadSprite`, `drawSquare` — `js/render.js`) parça komşu yol ve caddelere göre seçilir, kare görsel baklavaya yatırılır. Bağlantısız yol aynı görselin kırmızıya çalan kopyası. Nehirdeki yol hâlâ kodla çizilen köprü; Ağaçlı Bulvar görsel gelene kadar eskisi gibi.
- Kullanılmayan yapay zekâ parçaları `img/kaynak/yollar/kullanilmayan-*.png`; `donel-kavsak.png` döner ada için saklandı (2×2 yapı olarak eklenecek).
- Sürüm 0.4.2 (sürüm kodu 8).
- **Ana caddeler de yol görseliyle** (0.4.3): cadde kareleri `yol` parçalarıyla çizilir, oyuncunun yollarıyla aynı kavşak parçalarını kullanır (orta şerit yalnız düz parçada). Nehri taş korkuluklu köprüyle geçer, harita dışına aynı görselle uzanır, kumsalda çıkmazla biter.
- **Arabalar hedefe gider** (0.4.4, `stepCar` — `js/ambient.js`): önceden her kavşakta rastgele dönüyorlardı; oyuncunun yol ağına giren araba orada gidip gelip kalıyordu. Artık her araba bir hedef seçer (%45 harita kenarındaki cadde ucu, gerisi rastgele yol karesi) ve yol boyunca en kısa yoldan gider (BFS uzaklık haritası, yol değişince yenilenir). Varınca yeni hedef seçer; kenardaysa başka uçtan girer. Eşit seçenekte düz gitmeyi tercih eder.
- Araba görselleri için 12 prompt: `docs/araba-gorselleri-promptlar.pdf` (6 araç × ön/arka; sola gidenler aynalanacak). Görseller `img/araclar/` klasörüne gelecek.
- **Ana cadde ve köprü görselleri**: `cadde-duz.png` kaldırımlı, orta şeritli cadde; araç ondan 16 `cadde-*` parçası üretir (beyaz/krem arka plan da silinir, yol kenara değmiyorsa yalnız yollu satırlar alınır). Köprüler (`cadde-kopru`, `yol-kopru`, `yol-tas-kopru`): `BRIDGES` tablosundaki yüzey sütunlarına göre ölçeklenir, yüzey karadaki yolla aynı genişlikte, korkuluklar suyun üstüne taşar. Oyunda nehirdeki kare kuzeye ya da güneye bağlıysa köprü görseli (yan bağlantılar yok sayılır), değilse kodla çizilen köprü.
- Kullanılmayan: `kullanilmayan-cadde-t/dortyol` (genişlik tutmuyor, üstünde "50%" yazısı var), `bulvar-kopru` (bulvar parçaları gelince), `donel-kavsak-capraz` (kolları köşelere gidiyor, kareye oturmuyor).

## Araba görselleri ve yol modunda kaydırma
- Arabalar artık görselle çiziliyor: sedan, hatchback, taksi, dolmuş (img/araclar, kaynakları img/kaynak/araclar).
  `python3 tools/araba_hazirla.py` pembe arka planı siler. Sola giden yönler aynalanır; sedan ve hatchback
  hue-rotate ile renklendirilir. Görsel yüklenmezse eski kodla çizim devreye girer. Panelvan ve pikap görseli yok.
- Yol modu: boş yerden sürükleme haritayı kaydırır, dokunmak tek kare yol koyar, yoldan/caddeden başlayan sürükleme yol çizer.
- Bulvar görselle çiziliyor (bulvar-duz, bulvar-kopru; köprü kaynağında uçtaki direkler kesilir, 3 saksı aralığı bir kare).
- Döner kavşak (`kavsak`, 3x3, cat 'yol', Sv 5, 400): yol çubuğundan seçilir, dokunulan kare ortası olur.
  Yalnız dört kenarın ortasındaki koldan bağlanır (game.js linkOk/roadLink), ortası yol değil.
  Görsel img/yollar/kavsak.png tek parça (render.js drawRoundabouts). Arabalar halkada saat yönünün tersine döner (ambient.js canMove/pose).
- Tepe arazisindeki yollar da artık görselle çiziliyor.

## Her şey yıkılabilir, kasma ve sahil
- Sanayi ve İş Merkezi'ndeki gri beton zemin kaldırıldı (data.js groundTile).
- Ana cadde kareleri kaldırılabilir: caddeye dokun → "Bu kareyi kaldır" (game.js removeAvenue, s.removedAvenue).
  Kaldırılan kareye yol çizince cadde geri gelir (restoreAvenue). Yol modunda silgi caddeyi de siler.
- Tepecikler düzleştirilebilir: tepeye dokun → "Düzleştir (300)" (flattenHill, s.flattened). Tepe Villaları (allTerrain) hariç.
- Ağaç ve kayalar yalnız kilitli arsada ve harita dışında; arsa açılınca kendiliğinden kalkar.
- Hız: arazi/cadde/mahalle/açık arsa sorguları dizi tablolarından (syncGrids, her değişiklikte yenilenir);
  çim parsel başına tek baklava; ekran çözünürlüğü en çok 2x. DPR 1'de kare ortancası 33 → 16,7 ms.
- Sahil: kum ve kıyı kare görselleri yerine render.js drawShore — kum dokusu (kodla), dalgalı tek kıyı çizgisi
  (shoreLine), ıslak kum, sığ su ve köpük. Kare kare görsel testere dişi gibi görünüyordu. Kumdaki yollar da görselle.
- Ağaçlı bulvar: görseldeki kuşbakışı ağaçlar görünmüyordu; render.js boulevardTrees bulvarın yeşil şeridine (kenardan 0,235) kare başına kenar ortasına ayakta ağaç diker (yaprakli, mevsime göre). Dönemeçte dış yay ortası, yol ucunun kapalı kenarında ağaç yok, köprüde yok.

## İnşa menüsü bölümleri, geri tuşu, döndürme, toplu yıkım
- İnşa et önce bölümleri gösterir (CATEGORIES'e icon eklendi; "x/y açık"). Bölüme girince "‹ Geri" düğmesi.
  Yeni bina yerleştirmekten vazgeçince aynı bölüme dönülür (main.js buildCat).
- Geri tuşu: pencere ya da mod açıkken geçmişe tek kayıt eklenir (syncHistory); geri/Esc → goBack: mod iptal,
  bölümden bölümlere, pencereyi kapat. Android'de MainActivity OnBackPressedCallback webView.goBack yapar;
  geçmiş boşsa uygulamadan çıkar.
- Döndürme: b.flip (game.js flip). Görsel sağa-sola aynalanır (render drawSprite), baca dumanı x/y yer değiştirir.
  Bina kartında ve yerleştirirken "↔️ Döndür".
- Toplu yıkım: İnşa et → "🧨 Toplu yıkım" (mode 'demolish'). Dokun/sürükle seç-bırak, yıkılacaklar soluk + kırmızı + ❌.
  "Yık (n)" iki dokunuşla onaylanır; game.js sellMany (yollar dahil, geri ödeme ve birikmiş kira toplanır).
