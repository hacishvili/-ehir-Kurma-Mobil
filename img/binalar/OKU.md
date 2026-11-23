# Bina görselleri

Bu klasöre konan her görsel oyunda otomatik görünür. Görseli olmayan bina renkli kutu olarak çizilmeye devam eder; yani görseller teker teker eklenebilir.

## Dosya adları

| Bina | Dosya |
|---|---|
| Müstakil Ev | `ev.png` |
| Apartman | `apartman.png` |
| Villa | `villa.png` |
| Kafe | `kafe.png` |
| Market | `market.png` |
| Gece Kulübü | `gece.png` |
| Park | `park.png` |
| Okul | `okul.png` |
| Metro Durağı | `metro.png` |
| Atölye | `atolye.png` |

## Görsel kuralları

Bütün binaların aynı oyunun parçası gibi görünmesi için hepsi şu kurallara uymalı:

1. **Açı:** İzometrik, yukarıdan bakış. Binanın zemini yatay bir baklava (eşkenar dörtgen) şeklinde; genişliği yüksekliğinin 2 katı.
2. **Arka plan:** Şeffaf PNG. Bina kendi bahçesiyle (çim, çit, ağaç) gelir; bahçenin dışında hiçbir şey yok, gökyüzü yok.
3. **Yerleşim:** Bahçenin baklava şeklindeki zemini görselin tam genişliğinde. Sol ve sağ köşeleri görselin sol ve sağ kenarına, alt köşesi görselin alt kenarına değer.
4. **Işık:** Hep aynı yönden (sol üstten). Sol duvarlar açık, sağ duvarlar biraz koyu.
5. **Boyut:** 512 piksel genişlik önerilir. Yükseklik binaya göre serbest; uzun binalar uzun görsel olur.
6. **Tarz:** Bütün binalar aynı tarzda (aynı çizgi kalınlığı, aynı renk doygunluğu). Ayrıntılar: `docs/Gorsel-Tarz-Rehberi.md`.

Görsel karede biraz büyük ya da küçük durursa `js/data.js` içinde o binaya `spriteScale: 1.1` gibi bir ayar eklenir.

## Hazırlama aracı

Üretilen görseli bu klasöre elle koymak yerine şu komutla hazırla:

```bash
python3 tools/gorsel_hazirla.py img/kaynak/kafe.webp kafe
```

Araç siyah ya da beyaz düz arka planı siler, boş kenarları kırpar, açıyı oyunun karelerine uydurur ve `img/binalar/kafe.png` olarak kaydeder. Kaynak görsel `img/kaynak/` klasöründe saklanır; sonradan yeniden işlemek gerekirse oradan alınır.
