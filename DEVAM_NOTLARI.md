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
