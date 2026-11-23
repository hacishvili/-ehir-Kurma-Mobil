# Emlak Şehri (çalışma adı)

Mobil için emlak ve şehir kurma oyunu. Oyuncu küçük bir kasabada emlakçı olarak başlar: ev kurar, kiracı yerleştirir, kira toplar, binaların yerini akıllıca seçerek gelirini büyütür.

Tasarım dokümanı: [`docs/Oyun-Tasarim-Dokumani.pdf`](docs/Oyun-Tasarim-Dokumani.pdf)

## Şu anki durum: Prototip 0.1

Yol haritasının 1. adımı. Soru: **çekirdek döngü eğlenceli mi?**

Prototipte olanlar:

- Tek mahalle (Eski Çarşı), 12×12 harita, 9 arsa parseli (1'i açık, gerisi satın alınır)
- 4 bina kategorisi: konut, ticari, kamu ve yeşil alan, sanayi (toplam 10 bina)
- 4 kiracı tipi: öğrenci, genç çalışan, aile, emekli
- **Etki alanı:** park, kafe, okul gibi binalar çevresine kira bonusu, atölye ve gece kulübü bazı kiracılara ceza verir. Aynı türden etki en fazla ±%30'a kadar birikir.
- **Kira kontratları:** boş eve dokununca 3 kiracı kartı çıkar (süre, kira, XP, talep)
- **Yumuşak zamanlayıcı:** süre dolunca kira kaybolmaz, ama toplanmayan her saat memnuniyet düşer
- **Yol kuralı:** binalar ana caddeye bağlı bir yola komşu olmalı
- **Bedava taşıma**, yerleştirirken canlı bonus önizlemesi
- Sürükleyerek toplama, "sen yokken" özeti, danışman görevleri, seviye
- Canlı şehir: yollarda arabalar, kaldırımda insanlar, sallanan ağaçlar, bacadan duman, su parıltısı, kira toplanınca saçılan paralar (Menü'den kapatılabilir)
- Test için zaman hızlandırma (Menü → ×10 / ×60)
- İlerleme telefonda saklanır (sunucu yok)

Henüz olmayanlar (2. adım): emlak piyasası, diğer mahalleler, elmas, sosyal özellikler, ses, Higgsfield görselleri.

## Nasıl çalıştırılır

Oyun tarayıcıda çalışır, kurulum gerekmez. Dosyalar bir web sunucusundan açılmalı (dosyaya çift tıklamak çalışmaz):

```bash
npm start
```

Sonra tarayıcıda `http://localhost:8080` adresini aç.

## Testler

```bash
npm test
```

Oyun kuralları (bağlantı, etki alanı, kira, memnuniyet, kayıt) tarayıcısız test edilir.

## Dosyalar

| Dosya | Ne içerir |
|---|---|
| `js/data.js` | Bütün rakamlar: bina fiyatları, kiralar, etki alanları, kiracılar, görevler. Denge ayarı yalnız burada yapılır. |
| `js/game.js` | Oyun kuralları (ekrandan bağımsız) |
| `js/render.js` | İzometrik şehir çizimi |
| `js/ambient.js` | Şehirdeki hareket: arabalar, yürüyen insanlar, ağaçlar, duman, parıltı, saçılan paralar |
| `js/main.js` | Dokunma, menüler, kayıt |
| `css/style.css` | Ekran düzeni |
| `img/binalar/` | Bina görselleri. Kurallar ve dosya adları `img/binalar/OKU.md` içinde. |
| `tests/` | Kural testleri |
| `DEVAM_NOTLARI.md` | Oturumlar arası notlar: ne yapıldı, sırada ne var |
