# Görsel tarz rehberi (taslak)

Bütün bina görselleri bu rehbere göre üretilir. Amaç, şehrin tek elden çıkmış gibi görünmesi.

## Tarz: yarı gerçekçi, elle boyanmış

İlham Millionaire City'nin genel havası, ama görseller tamamen bize ait olacak. Hiçbir bina ya da sahne kopyalanmaz.

Millionaire City'den alınan dersler:

1. **Her bina kendi bahçesiyle gelir.** Ev tek başına değil; çimi, çiti, ağacı, havuzu ile birlikte. Bahçe karenin tamamını doldurur, böylece kareler görünmez olur ve şehir dolu, canlı görünür.
2. **Doygun, sıcak renkler.** Parlak yeşil çim, kırmızı kiremit, krem sıva, turkuaz havuz. Sönük gri yok.
3. **Her binanın tek bakışta tanınan bir işareti var.** Pizzacının kocaman tabelası, kulelerin camı, konakların kırmızı tuğlası. Küçük ekranda bina adını okumadan ne olduğunu anlatır.
4. **Detay süs olarak kullanılır.** Ağaç, çiçek, şemsiye, havuz binayı zenginleştirir ama binanın ana şeklini bozmaz.
5. **İnce koyu dış çizgi.** Binayı çimden ayırır, küçük boyutta netlik verir.

Bizde farklı olanlar:

- **Açı:** Millionaire City neredeyse tepeden bakıyordu. Biz izometrik açı kullanıyoruz (zemin baklava şeklinde). Binaların ön yüzleri daha çok görünür, tasarım daha çok öne çıkar.
- **Telefon için sadelik:** Bir bina ekranda yaklaşık 60–90 piksel. Küçük detaylar azaltılır, ana şekil ve renk büyütülür.
- **Yerel ton:** Eski Çarşı bir Türk kasabası havasında: cumbalı evler, kiremit çatılar, çatıda su deposu, çay bahçesi, manav tezgahı.
- **Yazı yok:** Tabelalarda harf yerine simge (fincan, elma, dişli). Yapay zekâ yazıyı bozuk çizer.

## Teknik kurallar

`img/binalar/OKU.md` içindeki kurallar geçerli. Özetle: şeffaf PNG, 512 piksel genişlik, ışık sol üstten, bahçenin baklava zemini görselin sol, sağ ve alt kenarına değer.

## Binalar

| Bina | Tarif | Tanıtıcı işaret |
|---|---|---|
| Müstakil Ev | İki katlı, krem sıva, kırmızı kiremit çatı, küçük bahçe, beyaz çit, meyve ağacı | Kırmızı çatı |
| Apartman | Beş katlı, pastel sıva, sıra balkonlar, renkli balkon tenteleri, çatıda su depoları | Balkon tenteleri |
| Villa | Beyaz taş, geniş teras, havuz, servi ağaçları | Turkuaz havuz |
| Kafe | Tek katlı, kırmızı-beyaz çizgili tente, önünde masalar ve şemsiyeler | Dev çay fincanı tabelası |
| Market | Yeşil tente, önünde meyve sebze kasaları | Elma tabelası |
| Gece Kulübü | Koyu cephe, mor ve pembe neon şeritler | Neon disko topu |
| Park | Ağaçlar, ortada çeşme, banklar, kıvrımlı yürüyüş yolu | Çeşme |
| Okul | Sarı sıva, kırmızı çatı, bahçede bayrak direği ve basketbol potası | Bayrak direği |
| Metro Durağı | Cam kubbeli yeraltı girişi, merdiven, çevresi taş döşeli | Cam kubbe |
| Atölye | Tuğla, testere dişi çatı, uzun baca ve duman, önünde kasalar | Bacadan duman |

## Üretim komutu şablonu

Görsel modelleri İngilizceyi daha iyi anladığı için şablon İngilizce. `[BİNA]` ve `[DETAYLAR]` yukarıdaki tablodan doldurulur.

```text
Isometric game building asset for a mobile city-builder. A single [BİNA] standing on its own
square lot, seen from a 2:1 isometric angle. The lot is a diamond-shaped patch of bright green
grass that fills the whole width of the image, with [DETAYLAR]. Stylized realism, hand-painted
look, clean readable shapes, slightly exaggerated proportions, saturated warm colors, soft
sunlight from the upper left, thin dark outline. Small Turkish town architecture.
Transparent background, nothing outside the lot, no text or letters, no people.
```

İlk bina onaylanınca sonraki binalar o binanın görseli **örnek görsel** olarak verilerek üretilir. Böylece ışık, renk ve çizgi tutarlı kalır.

## Açık kararlar

- Rehber onaylanmadı; ilk deneme görseline göre değişebilir.
- İleride büyük binalar (apartman, okul) 2×2 kare kaplayabilir. Şu an her bina 1 kare.
