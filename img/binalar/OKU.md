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
2. **Arka plan:** Şeffaf PNG. Zemin, çimen, gökyüzü yok; yalnız bina.
3. **Yerleşim:** Görsel tam bina genişliğinde. Zemin baklavasının sol ve sağ köşeleri görselin sol ve sağ kenarına, alt köşesi görselin alt kenarına değer.
4. **Işık:** Hep aynı yönden (sol üstten). Sol duvarlar açık, sağ duvarlar biraz koyu.
5. **Boyut:** 512 piksel genişlik önerilir. Yükseklik binaya göre serbest; uzun binalar uzun görsel olur.
6. **Tarz:** Bütün binalar aynı tarzda (aynı çizgi kalınlığı, aynı renk doygunluğu).

Görsel karede biraz büyük ya da küçük durursa `js/data.js` içinde o binaya `spriteScale: 1.1` gibi bir ayar eklenir.
