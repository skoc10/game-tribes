# Denge Raporu — MVP (Faz 5)

[GDD](GDD.md) 6.3'teki ölçüt: yapay zekâ–yapay zekâ simülasyonunda Sancaklılar–Külboyları kazanma oranı **%45–55**.

**Sonuç: iki eşleşme de bağımsız ölçümde hedef aralığında, ancak üst sınıra yakın.** 600'er maçta Yayılmacı aynasını Külboyları %54, Tüccar aynasını Külboyları %48,5 kazanıyor. Kişilikler arasındaki dengesizlik (Tüccar baskın) ise sürüyor.

## Ölçüm

`npm run simulate 300 all 5000` ve `npm run simulate 300 mirror 9000` — seri başına 300 maç, iki ayrı tohum kümesi. Bu tohumlar ayar sırasında **kullanılmadı** (ayar 1000–1199 üzerinde yapıldı). Oturma sırası her maç değişir. Parantez içindeki değer %95 güven aralığıdır.

| Seri | Tohumlar | Sancaklılar | Külboyları | Zafer türü | Ort. süre |
|---|---|---|---|---|---|
| 1'e 1, iki taraf da Yayılmacı | 5000–5299 | %48 (±6) | %52 (±6) | 142 fetih, 158 Harabe | 15,3 dk |
| 1'e 1, iki taraf da Yayılmacı | 9000–9299 | %44 (±6) | %56 (±6) | 152 fetih, 148 Harabe | 15,3 dk |
| **Yayılmacı aynası, 600 maç** | | **%45,8** | **%54,2 (±4)** | | |
| 1'e 1, iki taraf da Tüccar | 5000–5299 | %55 (±6) | %45 (±6) | 300 Harabe | 15,5 dk |
| 1'e 1, iki taraf da Tüccar | 9000–9299 | %48 (±6) | %52 (±6) | 300 Harabe | 15,6 dk |
| **Tüccar aynası, 600 maç** | | **%51,5** | **%48,5 (±4)** | | |

Okurken dikkat:

- Yayılmacı aynası aralığın içinde ama üst sınırına yakın; tek kümede %56 çıktı ve güven aralığı %58'e kadar uzanıyor. "Külboyları hafif önde" demek, "tam dengeli" demekten daha doğru.
- Önceki sürümde iki ayna zıt yönlerde aralığın dışındaydı (Külboyları %64–66 ve %36–44).
- Yayılmacı aynasında ilk koltuk %57–58 kazanıyor. Oturma sırası dönüşümlü olduğu için halk karşılaştırmasını etkilemez, ama haritada ya da işlem sırasında bir koltuk avantajına işaret eder.
- Hiçbir maç 60 dakikada sonuçsuz kalmadı.

### Üçlü diziliş (MVP'deki gibi)

Sabit bir Tüccar (Sancaklılar), sabit bir Yayılmacı (Külboyları) ve oyuncunun yerine geçen, halkı ve kişiliği dönüşümlü üçüncü koltuk. 300 maç (tohum 5000–5299); oranlar o koltuğun oynadığı maç sayısına göredir:

| Koltuk | Galibiyet |
|---|---|
| Sabit Tüccar (Sancaklılar) | 133/300 — %44 (±6) |
| Sabit Yayılmacı (Külboyları) | 46/300 — %15 (±4) |
| Üçüncü koltuk: Külboyları / Tüccar | 40/75 — %53 (±11) |
| Üçüncü koltuk: Sancaklılar / Tüccar | 37/75 — %49 (±11) |
| Üçüncü koltuk: Külboyları / Yayılmacı | 25/75 — %33 (±11) |
| Üçüncü koltuk: Sancaklılar / Yayılmacı | 19/75 — %25 (±10) |

Üç koltuk eşit olsaydı her biri ~%33 alırdı. 300 maçın 264'ü Harabe zaferiyle bitti. Fark artık halktan değil kişilikten geliyor: Tüccar hangi halkla oynarsa oynasın öne geçiyor.

## Ne öğrenildi

Aşağıdaki ölçümler `scripts/tune.ts` ile yeniden üretilebilir; bu betik veri dosyalarını değiştirmeden geçici değerlerle iki aynayı oynatır. Sayılar ayar tohumlarındandır (1000'den başlayan 100–200 maç), yani ±7–10 puan belirsizlik taşır. 2–4. maddeler, son değerler veri dosyalarına yazılmadan önce ölçüldü (kamp ganimeti ve kervan GDD değerlerindeyken); bugün aynısını görmek için denemeye `"campLoot":2.5` (ganimeti GDD düzeyine çıkarır) ve `"caravan":18` eklenmelidir.

1. **Ölçüm düzeneği sağlam.** İki halkın tüm özellikleri kapatılınca sonuç %50 ve %54:
   `npx tsx scripts/tune.ts '{"kulCost":1,"kulTrain":1,"farm":1,"cavalry":1,"RACES.kul.loot":false,"RACES.kul.buildingHp":1,"RACES.kul.techCost":1,"RACES.sancak.caravan":false,"RACES.sancak.gather.crystal":1}' 100`
2. **Farkı yaratan kamp ganimetiydi.** Külboyları'nın yalnızca ganimeti açık bırakılınca (indirim yok) iki aynayı da %73–79 kazanıyor; yalnızca ganimet kapatılınca Yayılmacı aynası %52'ye iniyor. Ganimet barışta orduyu büyütmüyor (8–10. dakikalarda iki tarafın ordu gücü eşit), ama ilk çarpışmadan sonra takviye için hazır kaynak bırakıyor.
3. **Birim indirimi çok hassas.** Ganimet 0,4 katına indirilmişken indirimi %5'ten %7'ye çıkarmak Külboyları'nı %56'dan %66'ya, %10 yapmak ~%80'e taşıyor.
4. **Sancak Kervanı yalnızca paktlı maçları etkiliyor.** Aynı ayarlarla kervan 18 → 9 → 5 → 0 kristal/dk iken Tüccar aynasında Külboyları %29 → %44 → %49 → %57 kazanıyor; Yayılmacı aynası (pakt yok) hiç değişmiyor. Böylece iki ayna iki ayrı kaldıraçla ayarlanabildi: ganimet ve kervan.
5. **Yapay zekânın davranışı sonucu sayılardan çok etkileyebiliyor.** İlk sürümdeki "ordusu 10'a ulaşan saldırır" kuralı, birimleri ucuz olan tarafı önce saldırtıp savunana yediriyordu; o haliyle ölçülen her şey yanıltıcıydı.

## Yapılan ayarlar

GDD'nin tam oyun değerleriyle Külboyları ayar tohumlarında iki aynayı %92 ve %100 kazanıyordu.

| Değer | GDD (tam oyun) | MVP | Dosya |
|---|---|---|---|
| Külboyları birim maliyeti | −%15 | **−%5** | `src/data/races.json` |
| Külboyları üretim süresi | −%15 | **−%5** | `src/data/races.json` |
| Kamp ganimeti (kademe 1 / 2 / 3) | 60+40 / 100+60+20 / 150+80+40 | **24+16 / 40+24+8 / 60+32+16** (0,4 katı) | `src/data/config.json` |
| Sancak Kervanı | 18 kristal/dk | **5 kristal/dk** | `src/data/config.json` |
| Sancaklılar çiftlik verimi | +%20 | +%20 (değişmedi) | `src/data/races.json` |

Öldürme ganimeti (birim %15, bina %20) GDD'deki gibi bırakıldı. Bu ayarlar yalnızca iki çağlı, ~15 dakikalık MVP içindir: kısa maçta Külboyları'nın zayıflıkları (kırılgan bina, pahalı teknoloji) devreye girmediği için güçlü yanlarının küçültülmesi gerekti. Çağ III–IV eklendiğinde GDD değerlerinden yeniden başlanmalıdır.

İki imza mekaniği sayıca küçüldü ama çalışıyor: Külboyları kamp temizleyince ganimet patlaması görüyor, Sancaklılar her pakt için kervan görüyor ve gelir alıyor. Bunların çocuklar için hâlâ "hissedilir" olup olmadığı (GDD 6.2'nin asıl amacı) ancak oyun testiyle anlaşılır.

Faz 5'te yapay zekâda değişenler (`src/sim/ai.ts`, `src/data/config.json`):

- Kale Çağı'nda köylü payları yiyecek/odun/kristal 0,45/0,30/0,25'ten 0,50/0,32/0,18'e çekildi.
- Kristal 120'yi geçince madenden köylü çekiyor ve artan kristali süvariye harcıyor; odun 400'ü geçip yiyecek geride kalınca oduncuların yarısını yiyeceğe kaydırıyor.
- Savaşta 18 yerine 30 askere kadar üretiyor; Harabe'ye 8 yerine 14 askerle gidiyor.
- Yayılmacı bir saldırıyı yalnızca rakibinden en az 1,2 kat güçlüyken başlatıyor (başladıktan sonra ordusu 3 askerin altına düşene kadar sürdürür); değilse Harabe'ye yöneliyor. Haine karşı koalisyonda ve Harabe kilitlenmesinde bu koşul aranmaz.
- Sahipsiz Harabe'de ordular birbirini kilitlediğinde, orada en çok askeri olan rakibe karşı durumu açıkça çözüyor (pakt varsa önce fesih bildirimi). Rakip art arda iki strateji turunda (~20 sn arayla) orada görülmedikçe harekete geçmez. İki kişilik için de geçerli.

## Açık işler

1. **Tüccar kişiliği üçlü maçlarda baskın, Yayılmacı zayıf.** Sabit Tüccar %44, sabit Yayılmacı %15 kazanıyor ve maçların %88'i Harabe ile bitiyor. Yayılmacı bir komşusuyla uğraşırken Tüccar Harabe'yi alıyor. Denenebilecekler: Harabe tutma süresini uzatmak, fesih bildirimini kısaltmak, Yayılmacı'nın Harabe sahibini öncelikli hedef seçmesi. Tüccar'ı daha temkinli yapmak (20 askerle gitmek) denendi ve işe yaramadı.
2. **Halk dengesi sınırda.** Yayılmacı aynasında Külboyları %54 (±4). Sayıların hassaslığı (madde 3) nedeniyle yapay zekâda ya da kurallarda yapılacak her değişiklikten sonra yeniden ölçülmeli.
3. **Koltuk avantajı.** Yayılmacı aynasında ilk koltuk %57–58 kazanıyor; nedeni araştırılmadı.
4. **Maçlar kısa.** Ortalama ~15 dakika; 8 dakikası barış.
5. **Yapay zekâ keşif yapmadan düşman binalarının yerini ve ordu gücünü biliyor.**
6. **İnsan oyuncuyla ölçüm yok.** Buradaki tüm sayılar yapay zekâ–yapay zekâ maçlarından gelir. GDD 6.3'teki diğer ölçütler çocuklarla oyun testi gerektirir ve yapılmadı.

## Yeniden ölçmek için

```bash
npm run simulate 300 all 5000
```

Bağımsız değişkenler sırasıyla: seri başına maç sayısı, `all` ya da `mirror` (üçlü seriyi atlar), tohum tabanı. Tohum tabanı verilmezse ayar kümesi (1000) kullanılır; doğrulama için her zaman başka bir taban verin.

Ayar denemeleri için `scripts/tune.ts` kullanılır (başındaki açıklamaya bakın); kalıcı değişiklik yapmadan değer dener.

Yeni yapay zekâ kuralları (güç üstünlüğü koşulu, Harabe kilidi) için ayrı birim testi yoktur; yalnızca tam maç testleri ve bu simülasyon tarafından kapsanırlar.
