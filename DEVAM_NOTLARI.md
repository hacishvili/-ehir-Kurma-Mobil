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
