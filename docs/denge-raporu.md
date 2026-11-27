# Denge Raporu — MVP (Faz 5)

[GDD](GDD.md) 6.3'teki ölçüt: yapay zekâ–yapay zekâ simülasyonunda Sancaklılar–Külboyları kazanma oranı **%45–55**.

**Sonuç: ölçüt eşleşme bazında karşılanmıyor.** Başlangıçtaki çok büyük fark kapatıldı, ama iki ayna eşleşmesi hâlâ aralığın dışında ve birbirine zıt yönde.

## Ölçüm

`npm run simulate 300 all 5000` — seri başına 300 maç, tohumlar 5000–5299. Bu tohumlar ayar sırasında **kullanılmadı** (ayar 1000–1199 üzerinde yapıldı). Oturma sırası her maç değişir. Parantez içindeki değer %95 güven aralığıdır.

| Seri | Sancaklılar | Külboyları | Zafer türü | Ort. süre |
|---|---|---|---|---|
| 1'e 1, iki taraf da Yayılmacı | %36 (±5) | **%64 (±5)** | 168 fetih, 132 Harabe | 15,2 dk |
| 1'e 1, iki taraf da Tüccar | **%58 (±6)** | %42 (±6) | 300 Harabe | 15,0 dk |

İki seriyi toplayıp "%47 – %53" demek yanıltıcı olur: ortalama, iki zıt sapma birbirini götürdüğü için dengeli görünür.

Hiçbir maç 60 dakikada sonuçsuz kalmadı. Koltuk sırasının etkisi yok (ilk koltuk %52 ve %50).

### Üçlü diziliş (MVP'deki gibi)

Sabit bir Tüccar (Sancaklılar), sabit bir Yayılmacı (Külboyları) ve oyuncunun yerine geçen, halkı ve kişiliği dönüşümlü üçüncü koltuk. 300 maç:

| Koltuk | Galibiyet |
|---|---|
| Sabit Tüccar (Sancaklılar) | %49 (±6) |
| Sabit Yayılmacı (Külboyları) | %14 (±4) |
| Üçüncü koltuk (dört bileşimin toplamı) | %36 |

Üç koltuk eşit olsaydı her biri ~%33 alırdı. 300 maçın 271'i Harabe zaferiyle bitti.

## Ne öğrenildi

1. **Külboyları erken saldırıda, Sancaklılar uzayan maçta üstün.** Yayılmacı aynasında karar barıştan hemen sonraki saldırıyla veriliyor; kamp ganimetiyle büyümüş Külboyları ordusu burada önde. Tüccar aynasında iki taraf Harabe'de karşılaşıp fesih bildirimini bekliyor; bu bir dakikada Sancaklılar'ın çiftlik ekonomisi öne geçiyor. Bu, GDD'de tasarlanan güç zirvelerinin (Külboyları: barış sonrası, Sancaklılar: orta oyun) ta kendisi; ancak iki çağlı, ~15 dakikalık MVP'de fazla keskin.
2. **Tek bir sayı iki aynayı birden düzeltmiyor.** Külboyları'nı zayıflatan her ayar Tüccar aynasını Sancaklılar lehine daha da bozuyor; tersi de geçerli.
3. **Yapay zekânın davranışı sonucu sayılardan daha çok etkiliyor.** Önceki sürümde "ordusu 10'a ulaşan saldırır" kuralı vardı; birimleri ucuz olan taraf önce saldırıp savunana yeniliyordu. O haliyle Külboyları'nın indirimini *kaldırmak* kazanma oranını *artırıyordu*. Kural "yalnızca belirgin güç üstünlüğü varsa saldır" olarak değiştirildi.
4. **Öldürme ganimeti (birim %15, bina %20) ve kervan geliri (9 ile 18 kristal/dk) sonucu ölçülebilir biçimde değiştirmedi.**

## Yapılan ayarlar

GDD'nin tam oyun değerleriyle (birim −%15, üretim −%15, çiftlik +%20) Külboyları ayar tohumlarında iki aynayı %92 ve %100 kazanıyordu.

| Değer | GDD (tam oyun) | MVP | Dosya |
|---|---|---|---|
| Külboyları birim maliyeti | −%15 | **−%5** | `src/data/races.json` |
| Külboyları üretim süresi | −%15 | **−%5** | `src/data/races.json` |
| Sancaklılar çiftlik verimi | +%20 | **+%30** | `src/data/races.json` |

Kamp ganimeti tablosu, öldürme ganimeti ve Sancak Kervanı geliri GDD'deki gibi bırakıldı. Bu ayarlar yalnızca iki çağlı MVP içindir.

Bu fazda yapay zekâda değişenler (`src/sim/ai.ts`, `src/data/config.json`):

- Kale Çağı'nda köylü payları yiyecek/odun/kristal 0,45/0,30/0,25'ten 0,50/0,32/0,18'e çekildi.
- Kristal 120'yi geçince madenden köylü çekiyor ve artan kristali süvariye harcıyor; odun 400'ü geçip yiyecek geride kalınca oduncuların yarısını yiyeceğe kaydırıyor.
- Savaşta 18 yerine 30 askere kadar üretiyor; Harabe'ye 8 yerine 14 askerle gidiyor.
- Yayılmacı yalnızca rakibinden en az 1,2 kat güçlüyse saldırıyor; değilse Harabe'ye yöneliyor.
- Sahipsiz Harabe'de ordular birbirini kilitlediğinde, orada en çok askeri olan rakibe karşı durumu açıkça çözüyor (pakt varsa önce fesih bildirimi). İki kişilik için de geçerli.

(Maçlar arası tohuma bağlı farklar — düşünme zamanı ve "cesaret" katsayısı — Faz 4'te eklenmişti.)

## Açık işler

1. **Halk dengesi (en önemlisi).** İki ayna da aralığın dışında. Denenebilecekler: kamp ganimetini barış süresinde azaltıp sonrasında artırmak; fesih bildirimi süresini kısaltmak; Sancaklılar'a erken oyunda işe yarayan bir güç vermek. Her deneme ayar tohumlarında yapılıp ayrı tohumlarda doğrulanmalı.
2. **Tüccar kişiliği üçlü maçlarda baskın.** Yayılmacı bir komşusuyla uğraşırken Tüccar Harabe'yi alıyor. Denenebilecekler: Harabe tutma süresini uzatmak, Yayılmacı'nın Harabe sahibini öncelikli hedef seçmesi. Tüccar'ı daha temkinli yapmak (20 askerle gitmek) denendi ve Tüccar aynasını bozduğu için geri alındı.
3. **Maçlar kısa.** Ortalama ~15 dakika; 8 dakikası barış. GDD ölçütü (≤ 30 dk) sağlanıyor, ama savaş evresi ~7 dakika.
4. **Yapay zekâ keşif yapmadan düşman binalarının yerini ve ordu gücünü biliyor.**
5. **İnsan oyuncuyla ölçüm yok.** Buradaki tüm sayılar yapay zekâ–yapay zekâ maçlarından gelir; bir insanın bu yapay zekâlara karşı ne kadar zorlandığı bilinmiyor. GDD 6.3'teki diğer ölçütler (savaş üçgenini açıklayabilme, kendiliğinden diplomasi, iki halkın farkını anlatabilme, yeniden oynama isteği) çocuklarla oyun testi gerektirir ve yapılmadı.

## Yeniden ölçmek için

```bash
npm run simulate 300 all 5000
```

Bağımsız değişkenler sırasıyla: seri başına maç sayısı, `all` ya da `mirror` (üçlü seriyi atlar), tohum tabanı. Ayar için bir tohum tabanı, doğrulama için başka bir tohum tabanı kullanın.
