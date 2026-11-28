# game-tribes

**Boylar: Kadim Miras** (çalışma adı) — 10–15 yaş için fantastik Orta Çağ temalı, tek oyunculu, duraklatılabilir gerçek zamanlı strateji oyunu.

Dört halktan birini seç, barış süresinde üssünü kur ve haritayı keşfet; ardından farklı kişiliklere sahip üç yapay zekâ komşunla savaşarak ya da anlaşarak kazan. Oyun; kaynak yönetimi, uzun vadeli planlama, kriz çözme, diplomasi ve neden-sonuç ilişkisi kurma becerilerini ders vermeden, kararların sonucunu göstererek geliştirmeyi amaçlar.

- 4 asimetrik ama eşit güçte halk: Sancaklılar, Yaprakdiller, Taşocaklılar, Külboyları
- 4 çağ, 4 kaynak, savaş üçgeni, seviye atlayan kahramanlar
- Ticaret, saldırmazlık ve ittifak anlaşmaları; ihanetin bedelini belirleyen Güvenilirlik Puanı
- 3 kazanma yolu: Fetih, Kadim Kalıntılar, Büyük Anıt

## Durum

Dijital MVP'nin beş geliştirme adımının ([GDD bölüm 6.4](docs/GDD.md)) kodu yazıldı. Harita simetrisi, koltuk adaleti ve Harabe kuralı düzeltildi; iki halk yapay zekâ maçlarında hedefe yakın, ancak son değerler taze tohumlarda doğrulanmadı ([rapor](docs/denge-raporu.md)); çocuklarla oyun testi yapılmadı. Şu an çalışan: harita, ekonomi, bina ve birim üretimi, savaş üçgeni, savaş sisi, izciyle otomatik keşif, tarafsız kamplar, kahraman seviyesi, Külboyları ganimeti, barış süresi, Kale Çağı, Demirci geliştirmeleri, Kadim Harabe, iki zafer yolu, iki kişilikli yapay zekâ (Tüccar, Yayılmacı), Saldırmazlık Paktı, Güvenilirlik Puanı, ihanet ve koalisyon, "Neden?" günlüğü ve Sancak Kervanı.

## Oyunu okumak

- **Binalar** ne olduklarını gösteren resimlerle çizilir (kuleli Ana Merkez, çatılı Ev, tarlalı Çiftlik, kalkan ve kılıçlı Kışla, hedef tahtalı Okçuluk Alanı, atlı Ahır, bacası tüten Demirci); her halkın yapı tarzı farklıdır.
- **Yabancı birliklerin altındaki halka** niyeti gösterir: kırmızı savaştasınız, yeşil paktınız var, beyaz anlaşma yok (saldırabilirler).
- **Sesli ve yazılı ikazlar:** üssüne yaklaşan birlikler (saldırı mı, geçiş mi), savaş ilanı, pakt teklifi, saldırı altındaki bina, barışın bitişi ve Harabe'nin el değiştirmesi ekranın üstünde belirir ve Türkçe okunur. Üst çubuktaki 🔊 düğmesi sesi kapatır.
- **Mini harita** sol alttadır; ikazların yeri üzerinde yanıp söner, tıklayınca kamera oraya gider.
- **Dört halk** seçilebilir. Yaprakdiller ve Taşocaklılar deneyseldir: özel birimleri ve binaları yoktur, dengeleri ölçülmemiştir.

## Çalıştırma

```bash
npm install
npm run dev     # oyunu tarayıcıda açar
npm test        # simülasyon testleri
npm run build   # tip denetimi + üretim derlemesi
npm run simulate  # ekransız yapay zekâ maçları ve kazanma oranları
```

## Yapı

- `src/data/` — birim, bina, halk ve denge değerleri (JSON). Denge ayarı kod değiştirmeden buradan yapılır.
- `src/sim/` — deterministik oyun simülasyonu; görüntüden bağımsızdır ve ekransız çalıştırılabilir.
- `src/render/` — Phaser 3 sahnesi ve arayüz.
- `tests/` — simülasyon testleri.
- `scripts/simulate.ts` — yapay zekâ–yapay zekâ maçlarıyla denge ölçümü.

## Dokümanlar

- [Oyun Tasarım Dokümanı (GDD)](docs/GDD.md)
- [Kâğıt Prototip Kiti](docs/kagit-prototip.md)
- [Denge Raporu (MVP)](docs/denge-raporu.md)
