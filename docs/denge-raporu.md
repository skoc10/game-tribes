# Denge Raporu — MVP (Faz 5)

[GDD](GDD.md) 6.3'teki ölçüt: yapay zekâ–yapay zekâ simülasyonunda Sancaklılar–Külboyları kazanma oranı **%45–55**.

**Sonuç: iki eşleşme de bağımsız ölçümde hedef aralığında.** Ayarda hiç kullanılmamış dört tohum kümesinde (eşleşme başına 1200 maç) Külboyları Yayılmacı aynasının %52,2'sini, Tüccar aynasının %48,4'ünü kazanıyor. Kişilikler arasındaki dengesizlik (Tüccar baskın) ise sürüyor.

## Ölçüm

`npm run simulate 300 mirror <tohum>` — küme başına 300 maç. Oturma sırası her maç değişir. Parantez içindeki değer %95 güven aralığıdır. Tablodaki değer Külboyları'nın kazanma oranıdır.

| Tohum tabanı | Yayılmacı aynası | Tüccar aynası |
|---|---|---|
| 70000 | %52 (±6) | %49 (±6) |
| 81000 | %50 (±6) | %48 (±6) |
| 92000 | %53 (±6) | %50 (±6) |
| 104000 | %54 (±6) | %47 (±6) |
| **Dördü birlikte (1200 maç)** | **%52,2 (±2,8)** | **%48,4 (±2,8)** |

Güven aralıkları (%49,4–55,0 ve %45,6–51,2) hedefin içinde kalıyor; Yayılmacı aynasının üst ucu tam sınırda.

Hangi tohumların ne için kullanıldığı önemli, çünkü bu rapor daha önce iki kez fazla iyimser çıktı:

- **Ayar:** 1000'den başlayan kümeler; kamp ganimeti ve kervanın kabaca yeri burada bulundu.
- **Son kervan seçimi:** 5000, 9000, 20000, 31000, 47000 ve 63000 kümelerinde kervan 5, 3 ve 2 karşılaştırıldı. Kervan 5 ile Tüccar aynası 1800 maçta %46,6 (±2,3) ile alt sınırdaydı ve bir kümede %39'a iniyordu; 3 ile altı kümenin ortalaması %49,7 oldu. Bu altı küme seçimde kullanıldığı için doğrulama sayılmaz.
- **Doğrulama:** yukarıdaki dört küme; seçimden sonra, tek seferde ölçüldü.

Tek tek kümeler %44 ile %56 arasında oynuyor (300 maçta beklenen dalgalanma). Tek bir kümeye bakıp karar vermeyin.

Yayılmacı aynasında ilk koltuk bazı kümelerde %57–58 kazanıyor. Oturma sırası dönüşümlü olduğu için halk karşılaştırmasını etkilemez, ama bir koltuk avantajına işaret eder. Hiçbir maç 60 dakikada sonuçsuz kalmadı.

### Üçlü diziliş (MVP'deki gibi)

Sabit bir Tüccar (Sancaklılar), sabit bir Yayılmacı (Külboyları) ve oyuncunun yerine geçen, halkı ve kişiliği dönüşümlü üçüncü koltuk. 300 maç (tohum 5000–5299); oranlar o koltuğun oynadığı maç sayısına göredir:

| Koltuk | Galibiyet |
|---|---|
| Sabit Tüccar (Sancaklılar) | 139/300 — %46 (±6) |
| Sabit Yayılmacı (Külboyları) | 47/300 — %16 (±4) |
| Üçüncü koltuk: Külboyları / Tüccar | 36/75 — %48 (±11) |
| Üçüncü koltuk: Sancaklılar / Tüccar | 34/75 — %45 (±11) |
| Üçüncü koltuk: Külboyları / Yayılmacı | 25/75 — %33 (±11) |
| Üçüncü koltuk: Sancaklılar / Yayılmacı | 19/75 — %25 (±10) |

Üç koltuk eşit olsaydı her biri ~%33 alırdı. 300 maçın 266'sı Harabe zaferiyle bitti. Fark artık halktan değil kişilikten geliyor: Tüccar hangi halkla oynarsa oynasın öne geçiyor.

## Ne öğrenildi

Aşağıdaki ölçümler `scripts/tune.ts` ile alındı; bu betik veri dosyalarını değiştirmeden geçici değerlerle iki aynayı oynatır. Sayılar ayar tohumlarındandır (taban 1000, 100–200 maç), yani ±7–10 puan belirsizlik taşır. 1–4. maddeler bağımsız incelemede yeniden üretildi; değerler "Yayılmacı aynası / Tüccar aynası" sırasıyla Külboyları'nın oranıdır.

1. **Ölçüm düzeneği sağlam.** İki halkın tüm özellikleri kapatılınca sonuç %50 / %54:
   `npx tsx scripts/tune.ts '{"kulCost":1,"kulTrain":1,"farm":1,"cavalry":1,"RACES.kul.loot":false,"RACES.kul.buildingHp":1,"RACES.kul.techCost":1,"RACES.sancak.caravan":false,"RACES.sancak.gather.crystal":1}' 100`
2. **GDD'nin tam oyun değerleriyle Külboyları %92 / %100 kazanıyor.**
3. **Kamp ganimeti tek başına büyük bir avantaj.** Diğer tüm özellikler kapalı, yalnızca ganimet GDD tablosuyla açıkken sonuç %72 / %84. Ganimet barışta orduyu büyütmüyor (8–10. dakikalarda iki tarafın ordu gücü eşit), ama ilk çarpışmadan sonra takviye için hazır kaynak bırakıyor.
4. **Birim indirimi çok hassas.** Ganimet 0,4 katı ve kervan 5 iken, maliyet ve üretim süresi indirimini birlikte %5'ten %7'ye çıkarmak Yayılmacı aynasında Külboyları'nı %56'dan %66'ya, %10 yapmak %79'a taşıyor.
5. **Sancak Kervanı yalnızca paktlı maçları etkiliyor.** Ganimet 0,4 katı iken kervan 18 → 9 → 5 → 0 kristal/dk için Tüccar aynası %29 → %44 → %49 → %57; Yayılmacı aynası (pakt yok) %56'da sabit. Böylece iki ayna iki ayrı kaldıraçla ayarlanabildi: ganimet ve kervan.
6. **Yapay zekânın davranışı sonucu sayılardan çok etkileyebiliyor.** İlk sürümdeki "ordusu 10'a ulaşan saldırır" kuralı, birimleri ucuz olan tarafı önce saldırtıp savunana yediriyordu. (Bu madde eski kodla ölçüldü, bugünkü depodan yeniden üretilemez.)

## Yapılan ayarlar

GDD'nin tam oyun değerleriyle Külboyları ayar tohumlarında iki aynayı %92 ve %100 kazanıyordu.

| Değer | GDD (tam oyun) | MVP | Dosya |
|---|---|---|---|
| Külboyları birim maliyeti | −%15 | **−%5** | `src/data/races.json` |
| Külboyları üretim süresi | −%15 | **−%5** | `src/data/races.json` |
| Kamp ganimeti (kademe 1 / 2 / 3) | 60+40 / 100+60+20 / 150+80+40 | **24+16 / 40+24+8 / 60+32+16** (0,4 katı) | `src/data/config.json` |
| Sancak Kervanı | 18 kristal/dk | **3 kristal/dk** | `src/data/config.json` |
| Sancaklılar çiftlik verimi | +%20 | +%20 | `src/data/races.json` |

Çiftlik verimi Faz 5'in ilk ayarında +%30'a çıkarılmıştı; bu sürümde GDD'deki +%20'ye geri alındı. Öldürme ganimeti (birim %15, bina %20) GDD'deki gibi bırakıldı. Bu ayarlar yalnızca iki çağlı, ~15 dakikalık MVP içindir: kısa maçta Külboyları'nın zayıflıkları (kırılgan bina, pahalı teknoloji) devreye girmediği için güçlü yanlarının küçültülmesi gerekti. Çağ III–IV eklendiğinde GDD değerlerinden yeniden başlanmalıdır.

İki imza mekaniği sayıca küçüldü ama çalışıyor: Külboyları kamp temizleyince ganimet patlaması görüyor, Sancaklılar her pakt için kervan görüyor ve gelir alıyor. Bunların çocuklar için hâlâ "hissedilir" olup olmadığı (GDD 6.2'nin asıl amacı) ancak oyun testiyle anlaşılır.

Faz 5'te yapay zekâda değişenler (`src/sim/ai.ts`, `src/data/config.json`):

- Kale Çağı'nda köylü payları yiyecek/odun/kristal 0,45/0,30/0,25'ten 0,50/0,32/0,18'e çekildi.
- Kristal 120'yi geçince madenden köylü çekiyor ve artan kristali süvariye harcıyor; odun 400'ü geçip yiyecek geride kalınca oduncuların yarısını yiyeceğe kaydırıyor.
- Savaşta 18 yerine 30 askere kadar üretiyor; Harabe'ye 8 yerine 14 askerle gidiyor.
- Yayılmacı bir saldırıyı yalnızca rakibinden en az 1,2 kat güçlüyken başlatıyor (başladıktan sonra ordusu 3 askerin altına düşene kadar sürdürür); değilse Harabe'ye yöneliyor. Haine karşı koalisyonda ve Harabe kilitlenmesinde bu koşul aranmaz.
- Sahipsiz Harabe'de ordular birbirini kilitlediğinde, orada en çok askeri olan rakibe karşı durumu açıkça çözüyor (pakt varsa önce fesih bildirimi). Rakip art arda iki strateji turunda (~20 sn arayla) orada görülmedikçe harekete geçmez. İki kişilik için de geçerli.

## Açık işler

1. **Tüccar kişiliği üçlü maçlarda baskın, Yayılmacı zayıf.** Sabit Tüccar %44, sabit Yayılmacı %15 kazanıyor ve maçların %88'i Harabe ile bitiyor. Yayılmacı bir komşusuyla uğraşırken Tüccar Harabe'yi alıyor. Denenebilecekler: Harabe tutma süresini uzatmak, fesih bildirimini kısaltmak, Yayılmacı'nın Harabe sahibini öncelikli hedef seçmesi. Tüccar'ı daha temkinli yapmak (20 askerle gitmek) denendi ve işe yaramadı.
2. **Halk dengesi kırılgan.** Sonuç hedefin içinde, ama birim indirimi ve kervan gibi değerlere çok hassas (yukarıdaki 4. ve 5. maddeler) ve Yayılmacı aynasının güven aralığı üst sınıra dayanıyor. Yapay zekâda ya da kurallarda yapılacak her değişiklikten sonra, yeni tohum kümeleriyle yeniden ölçülmeli.
3. **Koltuk avantajı.** Yayılmacı aynasında ilk koltuk %57–58 kazanıyor; nedeni araştırılmadı.
4. **Maçlar kısa.** Ortalama ~15 dakika; 8 dakikası barış.
5. **Yapay zekâ keşif yapmadan düşman binalarının yerini ve ordu gücünü biliyor.**
6. **İnsan oyuncuyla ölçüm yok.** Buradaki tüm sayılar yapay zekâ–yapay zekâ maçlarından gelir. GDD 6.3'teki diğer ölçütler çocuklarla oyun testi gerektirir ve yapılmadı.

## Yeniden ölçmek için

```bash
npm run simulate 300 mirror 70000
```

Üçlü diziliş tablosu için:

```bash
npm run simulate 300 all 5000
```

Bağımsız değişkenler sırasıyla: seri başına maç sayısı, `all` ya da `mirror` (üçlü seriyi atlar), tohum tabanı. Tohum tabanı verilmezse ayar kümesi (1000) kullanılır; doğrulama için her zaman başka bir taban verin.

Ayar denemeleri için `scripts/tune.ts` kullanılır (başındaki açıklamaya bakın); kalıcı değişiklik yapmadan değer dener.

Yeni yapay zekâ kuralları (güç üstünlüğü koşulu, Harabe kilidi) için ayrı birim testi yoktur; yalnızca tam maç testleri ve bu simülasyon tarafından kapsanırlar.
