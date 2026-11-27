# Denge Raporu — MVP (Faz 5)

[GDD](GDD.md) 6.3'teki ölçüt: yapay zekâ–yapay zekâ simülasyonunda Sancaklılar–Külboyları kazanma oranı **%45–55**.

Ölçüm `npm run simulate 100` ile yapıldı (seri başına 100 maç, tohumlar 1000–1099, oturma sırası her maç değişir). Bir maç ekransız olarak bir saniyenin altında oynanır.

## Sonuç

| Seri | Sancaklılar | Külboyları | Zafer türü | Ortalama süre |
|---|---|---|---|---|
| 1'e 1, iki taraf da Yayılmacı | %43 | %57 | 90 fetih, 10 Harabe | 16,0 dk |
| 1'e 1, iki taraf da Tüccar | %55 | %45 | 100 Harabe | 15,2 dk |
| **İki seri birlikte (200 maç)** | **%49** | **%51** | | |

İki seri birlikte hedef aralığın içinde. Yayılmacı aynası tek başına %57 ile aralığın 2 puan dışında; 100 maçta ölçüm belirsizliği yaklaşık ±5 puan olduğu için bu fark kesin değildir.

Hiçbir maç 60 dakikada sonuçsuz kalmadı.

## Yapılan ayarlar

İlk ölçümde Külboyları iki aynada da açık ara öndeydi (%88 ve %100). Nedeni: MVP iki çağla ve ~15 dakikada bittiği için Külboyları'nın zayıflıkları (kırılgan bina, pahalı teknoloji) neredeyse hiç devreye girmiyor, güçlü yanları ise (ucuz ve hızlı birim, kamp ganimeti) tam da maçın karara bağlandığı dakikalarda etkili oluyor.

| Değer | GDD (tam oyun) | MVP | Dosya |
|---|---|---|---|
| Külboyları birim maliyeti | −%15 | **−%5** | `src/data/races.json` |
| Külboyları üretim süresi | −%15 | **−%5** | `src/data/races.json` |
| Sancaklılar çiftlik verimi | +%20 | **+%30** | `src/data/races.json` |

Kamp ganimeti tablosu ve Sancak Kervanı geliri (18 kristal/dk) GDD'deki gibi bırakıldı. Bu ayarlar yalnızca iki çağlı MVP içindir; Çağ III–IV eklendiğinde yeniden ölçülmelidir.

Yapay zekâda yapılan düzeltmeler (denge ölçümünü bozan davranışlar):

- Kristal biriktiği halde madende köylü tutmuyor; artan kristali süvariye harcıyor.
- Savaşta 18 yerine 30 askere kadar üretiyor, Harabe'ye 8 yerine 14 askerle gidiyor.
- Sahipsiz Harabe'de iki ordu birbirini kilitlediğinde Tüccar durumu açıkça (önce fesih bildirimiyle) çözüyor.
- Her maç için tohuma bağlı küçük farklar (düşünme zamanı, "cesaret" katsayısı) eklendi; önceden aynı dizilişteki her maç birebir aynı oynanıyordu.

## Açık bulgular

1. **Üçlü dizilişte Tüccar kişiliği baskın.** MVP dizilişinde (bir Tüccar Sancaklılar, bir Yayılmacı Külboyları, üçüncü koltuk dönüşümlü) 100 maçın 82'si Harabe zaferiyle bitti ve 69'unu Sancaklılar/Tüccar kazandı. Yayılmacı bir komşusuyla savaşırken Tüccar Harabe'yi alıyor. Bu bir halk dengesi değil, kişilik ve kural meselesidir. Denenebilecekler: Harabe tutma süresini uzatmak, Harabe sahibine karşı fesih bildirimini kısaltmak, Yayılmacı'nın Harabe sahibini öncelikli hedef seçmesi. Tüccar'ı daha temkinli yapmak (20 askerle gitmek) denendi; Tüccar aynasını %66–34'e bozduğu için geri alındı.
2. **Maçlar kısa.** Ortalama ~16 dakika; barış 8 dakika olduğundan savaş evresi ~8 dakika sürüyor. GDD ölçütü (≤ 30 dk) sağlanıyor, ama çocuklarla testte "çok çabuk bitti" hissi izlenmeli.
3. **Yapay zekâ keşif yapmadan düşman binalarının yerini ve ordu gücünü biliyor.** Yalnızca asker bileşimi ve üs savunması görüşe bağlı.
4. **İnsan oyuncuyla ölçüm yok.** Buradaki tüm sayılar yapay zekâ–yapay zekâ maçlarından gelir. GDD 6.3'teki diğer ölçütler (savaş üçgenini açıklayabilme, kendiliğinden diplomasi, iki halkın farkını anlatabilme, yeniden oynama isteği) çocuklarla oyun testi gerektirir ve yapılmadı.

## Yeniden ölçmek için

```bash
npm run simulate 100
```
