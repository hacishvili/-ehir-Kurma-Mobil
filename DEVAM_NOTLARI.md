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
