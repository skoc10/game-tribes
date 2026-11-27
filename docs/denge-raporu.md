# Denge Raporu — MVP (Faz 5)

[GDD](GDD.md) 6.3'teki ölçüt: yapay zekâ–yapay zekâ simülasyonunda Sancaklılar–Külboyları kazanma oranı **%45–55**.

**Sonuç: yapısal sorunlar giderildi; halk dengesi hedefe yakın ama son değerler taze tohumlarda doğrulanmadı.** Son ölçümde (iki tohum kümesi, eşleşme başına 600 maç) Külboyları Yayılmacı aynasının %55–57'sini, Tüccar aynasının %50–52'sini kazanıyor. Hedef %45–55; Yayılmacı aynası üst sınırın hemen üstünde.

Bu sürümde sayı ayarından önce, tüm önceki ölçümleri çarpıtan dört yapısal sorun bulundu ve düzeltildi. Önceki raporlardaki yüzdeler bu nedenle geçersizdir.

## Bulunan yapısal sorunlar

1. **Harita simetrik değildi.** Bir üs, gerçek ayna konumundan bir karo kaymıştı; arkasında bina kuracak yer azdı, çiftliklerini daha yavaş kuruyor ve daha az asker çıkarıyordu. İki ve dört kişilik haritalar artık karo karo nokta simetrik (testle korunuyor); üç kişilikte kareli ızgarada tam simetri mümkün değil, kaynak sayıları eşit ya da en çok 3 ağaç farklı.
2. **Yapay zekâ ekran yönüne göre karar veriyordu.** Bina yeri seçiminde eşitlikler tarama sırasıyla bozulduğu için alttaki üs Kışla'sını kampın dibine kuruyor, yeni askerleri tek tek kampa yem oluyordu (savaş öncesi ortalama 5,1 asker kaybı, üstte 0,9). Yer seçimi, en yakın kaynak, kamp yaratıklarının dizilişi, yol bulma ve hedef seçimindeki eşitlikler artık yönden bağımsız.
3. **Tohumlama hatalıydı.** Ardışık tohumlar (1000, 1001, …) üreteci birbirine çok yakın durumlarda başlatıyordu; aynı ayar bir tohum aralığında %52, başka bir aralıkta %63 veriyordu. Önceki turlarda "ayar kümesinde tutup doğrulama kümesinde tutmayan" sonuçların nedeni buydu. Tohum artık kullanılmadan önce karıştırılıyor; altı farklı aralıkta sonuçlar birbirini tutuyor (%60–66 ve %50–56).
4. **Yapay zekâ askerlerini tek tek gönderiyordu.** Kampa, Harabe'ye ve düşman üssüne giden takviyeler artık toplanma noktasında birikip grup halinde gidiyor.

Ek olarak aynı tikte vurulan darbeler artık eşzamanlı: işlem sırası kimseye ilk vuruş avantajı vermiyor.

**İlk koltuk avantajı:** Aynı halk ve kişilik her iki koltukta otururken ilk koltuğun kazanma oranı başta %60–90 arasındaydı; düzeltmelerden sonra on iki ölçümün ortalaması %52 (tek tek ölçümler %43–65). Bir istisna kaldı: iki taraf da Sancaklılar/Tüccar iken ilk koltuk hâlâ belirgin önde (%57–73). Kervan ya da "artan kristali süvariye harca" kuralı kapatılınca fark kayboluyor; kök neden bulunamadı. İnsan oyuncunun başlangıç köşesi artık her maç rastgele.

## Kural değişikliği: Harabe'nin başında nöbet

Maçların %86–89'u Harabe ile bitiyordu; tutma süresini uzatmak, fesih bildirimini kısaltmak ya da Tüccar'ı temkinli yapmak bunu değiştirmedi (fetih %14–19'da kaldı). Neden yapısaldı: Harabe bir kez alınınca başında durmak gerekmiyordu.

Yeni kural: **sayaç yalnızca sahibin askeri Harabe'deyken ve orada savaşta olduğu bir düşmanın askeri yokken işler.** Harabe'yi tutmak bir orduyu oraya bağlar ve üssü açık bırakır. Sonuç (üçlü diziliş, ayar tohumları, 200–300 maç): fetih oranı %30–37, sabit Tüccar %34–43, sabit Yayılmacı %19–28. Eşit olsaydı her koltuk ~%33 alırdı; Yayılmacı hâlâ geride ama fark yarıya indi.

Bu kuralla ortaya çıkan kilitlenme (sahibi başında olmayan Harabe'de iki ziyaretçi ordunun birbirini engellemesi; maçların %7'si 60 dakikada bitmiyordu) yapay zekânın kilitlenmeyi açıkça çözmesiyle giderildi.

## Son değerler

Yapısal düzeltmelerden sonra imza mekaniklerini küçültmeye gerek kalmadı: kamp ganimeti GDD tablosuna geri döndü.

| Değer | GDD (tam oyun) | MVP | Dosya |
|---|---|---|---|
| Külboyları birim maliyeti ve üretim süresi | −%15 | **−%5** | `src/data/races.json` |
| Kamp ganimeti | 60+40 / 100+60+20 / 150+80+40 | aynı | `src/data/config.json` |
| Öldürme ganimeti (birim / bina) | %15 / %20 | **kapalı** | `src/data/config.json` |
| Sancak Kervanı | 18 kristal/dk | **12 kristal/dk** | `src/data/config.json` |
| Sancaklılar çiftlik verimi | +%20 | aynı | `src/data/races.json` |

Ölçümler (`scripts/tune.ts`, tohum tabanı 1000 ve 2000, 300'er maç, Külboyları'nın oranı):

| Ayar | Yayılmacı aynası | Tüccar aynası |
|---|---|---|
| Öldürme ganimeti açık (%15 / %20) | %63, %66 | %56, %54 |
| **Öldürme ganimeti kapalı (seçilen)** | **%55, %57** | **%52, %50** |
| Kamp ganimeti 0,85 katı | %56, %57 | %38, %42 |
| Birim indirimi %3 | %68, %66 | %70, %74 |
| Birim indirimi yok | %62, %61 | %38, %34 |
| Külboyları bina canı −%30 | %63, %66 | %56, %54 |

Dürüstlük notu: seçilen ayar bu iki tohum kümesinde ölçüldü, **ayrı kümelerde doğrulanmadı**; denge çalışması bu noktada durduruldu. Tohumlama düzeltildiği için aralıklar arası tutarsızlık beklenmiyor, ama Yayılmacı aynasındaki %55–57 hedefin üst sınırında ya da hemen üstünde. Üçlü diziliş de son ayarla (öldürme ganimeti kapalı) yeniden ölçülmedi.

Birim indirimi beklenmedik biçimde doğrusal değil (%3 indirim, %5'ten de %0'dan da iyi sonuç veriyor); bu, sonucun yapay zekânın zamanlamalarına çok duyarlı olduğunu gösteriyor.

## Açık işler

1. **Son değerlerin taze tohumlarda doğrulanması** (`npm run simulate 300 all <yeni taban>`), üçlü diziliş dahil.
2. **Yayılmacı kişiliği üçlü maçlarda hâlâ geride** (%19–28).
3. **Sancaklılar/Tüccar aynasındaki koltuk etkisi** (yukarıda).
4. **Öldürme ganimeti kapalı.** GDD 2.6'daki "düşman kayıplarından ganimet" MVP'de yok; küçük bir değerle (ör. %5 / %10) yeniden açılıp ölçülebilir.
5. **Dört kişilik haritada yakın kamp ile ara kamp birbirine çok yakın** (5 karo); MVP üç kişilik olduğu için düzeltilmedi.
6. **Yapay zekâ keşif yapmadan düşman binalarının yerini ve ordu gücünü biliyor.**
7. **İnsan oyuncuyla ölçüm yok.** Tüm sayılar yapay zekâ–yapay zekâ maçlarından gelir; yapay zekâ aynalarında küçük farklar kartopu etkisiyle büyür, insan maçları bu kadar kırılgan olmayabilir. GDD 6.3'teki diğer ölçütler çocuklarla oyun testi gerektirir ve yapılmadı. Sıradaki adım budur.

## Yeniden ölçmek için

```bash
npm run simulate 300 all 70000
```

Bağımsız değişkenler sırasıyla: seri başına maç sayısı, `all` ya da `mirror` (üçlü seriyi atlar), tohum tabanı. Ayar denemeleri için `scripts/tune.ts` (veri dosyalarını değiştirmeden geçici değer dener; üçlü seriyi de raporlar), koltuk adaleti için `scripts/seat.ts` kullanılır.
