# Google Play'e yükleme rehberi

Bu belge, Emlak Şehri'ni Google Play'de **iç test** (internal testing) ile en fazla 100 kişiye göndermek için gereken her şeyi içerir. Mağaza metinleri kopyalanmaya hazırdır.

## Uygulama bilgileri

| Alan | Değer |
|---|---|
| Uygulama adı | Emlak Şehri |
| Paket adı (applicationId) | `com.emlaksehri.oyun` — ilk yüklemeden sonra **değiştirilemez** |
| Sürüm | 0.1.0 (versionCode 1) |
| Kategori | Oyun → Simülasyon |
| Fiyat | Ücretsiz |
| Reklam | Yok |
| Uygulama içi satın alma | Yok (henüz) |

## Adım adım

1. **Play Console → Uygulama oluştur.** Ad: Emlak Şehri. Dil: Türkçe. Oyun. Ücretsiz.
2. **Play Uygulama İmzalama** açık kalsın (varsayılan). Bizim anahtarımız yalnız "yükleme anahtarı" olur; kaybolursa Google destek ekibinden sıfırlatılabilir.
3. **Test → İç test → Yeni sürüm oluştur.** `emlak-sehri-0.1.0.aab` dosyasını yükle. Sürüm notu: aşağıda.
4. **Test edenler:** Bir e-posta listesi oluştur, test edeceklerin Gmail adreslerini ekle. Kaydedince bir katılım linki çıkar; o linki onlara gönder.
5. **Uygulama içeriği** bölümündeki formları doldur (aşağıdaki cevaplar). İç test için mağaza sayfasının tamamı zorunlu değildir ama doldurmak iyi olur.

## Mağaza metinleri

**Kısa açıklama (80 karakter):**

> Kasabanı büyüt: ev kur, kiracı seç, kira topla, şehri bir emlak imparatorluğuna çevir.

**Tam açıklama:**

> Emlak Şehri'nde küçük bir kasabada emlakçı olarak başlarsın. Ev kur, kiracını seç, kirayı topla ve kasabayı adım adım bir şehre dönüştür.
>
> **Her binanın yeri önemli.** Kafe, park, okul gibi binalar çevresindeki evlerin kirasını artırır; atölye çok kazandırır ama komşularını rahatsız eder. Binaları istediğin an bedava taşı, en iyi yerleşimi bul.
>
> **Kiracılarını tanı.** Öğrenci, genç çalışan, aile, emekli, sanatçı ve ünlü: her birinin istekleri farklı. Memnun kalan kiracı kontratını yeniler, bazen de özel bir istekte bulunur. Yerine getirirsen nadir süslemeler açılır.
>
> **Ceza yok, acele yok.** Kira süresi dolunca kaybolmaz, sadece kiracının memnuniyeti biraz düşer. Kısa molalarda da, akşam uzun oturumda da rahat oynanır.
>
> **Yeni mahalleler aç.** Sahil'de deniz manzarası, Sanayi Bölgesi'nde yüksek gelir, İş Merkezi'nde gökdelenler, Tepe Villaları'nda ünlü kiracılar seni bekliyor.
>
> **Emlak piyasasını takip et.** Her mahallenin değeri memnun kiracılara, iyi yerleşime ve haberlere göre değişir. Ucuzken kur, değerlenince sat.
>
> Ayrıca: günlük hedefler, koleksiyon parçaları, canlı şehir (arabalar, yürüyen insanlar, bacadan tüten duman) ve sakin bir müzik.

**Sürüm notu (0.1.0):**

> İlk test sürümü. Denge ayarları henüz yapılmadı; kira, fiyat ve süreler hakkındaki her görüşün çok değerli.

## Uygulama içeriği formları

**Gizlilik politikası:** Bir web adresi ister. `docs/gizlilik-politikasi.html` dosyası hazır; herkese açık bir adreste yayınlanması gerekir (örneğin Claude'un oyun linki gibi paylaşılan bir sayfa ya da GitHub Pages).

**Veri güvenliği:**
- Uygulama kullanıcı verisi topluyor mu? **Hayır.**
- Uygulama kullanıcı verisi paylaşıyor mu? **Hayır.**
- Açıklama: Oyun ilerlemesi yalnız cihazda saklanır. Hesap, konum, kişi bilgisi, analiz ya da reklam yoktur.
- Not: Oyun yazı tiplerini Google Fonts'tan yükler; bu, kişisel veri toplamak sayılmaz ama ileride yazı tipleri pakete gömülebilir.

**Reklam içeriyor mu?** Hayır.

**Hedef kitle:** 13 yaş ve üzeri (çocuklara yönelik değil). Daha küçük yaşı seçmek ek Aile politikası şartları getirir.

**İçerik derecelendirme anketi:** Kategori "Oyun". Şiddet, cinsellik, kumar, uyuşturucu, küfür: hepsi **Hayır**. Kullanıcı etkileşimi / sohbet: **Hayır**. Satın alma: **Hayır**. Beklenen sonuç: Herkes / PEGI 3.

**Erişim:** Uygulamanın tamamı giriş gerektirmeden kullanılabilir.

## Görseller (mağaza sayfası için)

- Uygulama ikonu 512×512: `docs/play/ikon-512.png`
- Öne çıkan görsel 1024×500: `docs/play/one-cikan.png`
- Telefon ekran görüntüleri (en az 2): `docs/play/ekran-*.png`

## Yeni sürüm yükleme (sonraki seferler)

1. `android/app/build.gradle` içinde `versionCode` bir artırılır, `versionName` güncellenir.
2. `npm run android` (web dosyalarını Android projesine kopyalar).
3. `cd android && ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
4. Play Console'da aynı iç test kanalına yeni sürüm olarak yüklenir.

**İmza anahtarı:** `emlak-sehri-yukleme.jks` ve şifresi güvenli bir yerde saklanmalı (git'e girmez). Kaybolursa Play Console → Uygulama imzalama → "Yükleme anahtarını sıfırla" ile yenisi istenir.
