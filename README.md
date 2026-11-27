# game-tribes

**Boylar: Kadim Miras** (çalışma adı) — 10–15 yaş için fantastik Orta Çağ temalı, tek oyunculu, duraklatılabilir gerçek zamanlı strateji oyunu.

Dört halktan birini seç, barış süresinde üssünü kur ve haritayı keşfet; ardından farklı kişiliklere sahip üç yapay zekâ komşunla savaşarak ya da anlaşarak kazan. Oyun; kaynak yönetimi, uzun vadeli planlama, kriz çözme, diplomasi ve neden-sonuç ilişkisi kurma becerilerini ders vermeden, kararların sonucunu göstererek geliştirmeyi amaçlar.

- 4 asimetrik ama eşit güçte halk: Sancaklılar, Yaprakdiller, Taşocaklılar, Külboyları
- 4 çağ, 4 kaynak, savaş üçgeni, seviye atlayan kahramanlar
- Ticaret, saldırmazlık ve ittifak anlaşmaları; ihanetin bedelini belirleyen Güvenilirlik Puanı
- 3 kazanma yolu: Fetih, Kadim Kalıntılar, Büyük Anıt

## Durum

Dijital MVP geliştiriliyor ([GDD bölüm 6](docs/GDD.md)). Şu an çalışan: harita, köylüler, kaynak toplama, bina kurma, birim üretimi ve nüfus.

## Çalıştırma

```bash
npm install
npm run dev     # oyunu tarayıcıda açar
npm test        # simülasyon testleri
npm run build   # tip denetimi + üretim derlemesi
```

## Yapı

- `src/data/` — birim, bina, halk ve denge değerleri (JSON). Denge ayarı kod değiştirmeden buradan yapılır.
- `src/sim/` — deterministik oyun simülasyonu; görüntüden bağımsızdır ve ekransız çalıştırılabilir.
- `src/render/` — Phaser 3 sahnesi ve arayüz.
- `tests/` — simülasyon testleri.

## Dokümanlar

- [Oyun Tasarım Dokümanı (GDD)](docs/GDD.md)
- [Kâğıt Prototip Kiti](docs/kagit-prototip.md)
