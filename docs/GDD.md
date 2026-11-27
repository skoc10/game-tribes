# Boylar: Kadim Miras — Oyun Tasarım Dokümanı (GDD)

> **Çalışma adı:** Boylar: Kadim Miras (depo: `game-tribes`)
> **Sürüm:** 0.2 (tasarım taslağı)
> **Tür:** Duraklatılabilir gerçek zamanlı strateji, tek oyunculu
> **Hedef kitle:** Birincil 10–15 yaş. 16–20 yaş için en üst zorluk (Komutan) yeterli derinliği sunar.
> **Platform (MVP):** Web tarayıcı, fare + klavye

Bu dokümandaki tüm sayılar **başlangıç değeridir**. Oyun testleri ve denge simülasyonlarıyla ayarlanacaktır; kurallar ve ilişkiler ise bağlayıcıdır.

## İçindekiler

1. Oyun Özeti ve Temel Döngü
2. Irklar ve Denge Tablosu
3. Ekonomi ve Teknoloji Ağacı
4. Savaş ve Diplomasi Kuralları
5. 10–15 Yaş İçin Öğrenme ve Eğlence Dengesi
6. İlk Prototip (MVP) Önerisi
7. Ekler (sözlük, açık tasarım soruları)

---

## 1. Oyun Özeti ve Temel Döngü

### 1.1 Tek cümlede oyun

Dört halktan birini seç, barış süresinde üssünü kur ve haritayı keşfet; barış bittiğinde üç yapay zekâ komşunla savaşarak, anlaşarak ya da ikisini birden yaparak üç farklı yoldan birini kullanıp kazan.

### 1.2 Tasarım sütunları

| Sütun | Anlamı | Somut karşılığı |
|---|---|---|
| Hız değil, karar | Hızlı tıklayan değil iyi düşünen kazanır | Sınırsız duraklatma, duraklatılmışken emir verme, 0.5x/1x/1.5x hız |
| Her sonucun bir nedeni var | Oyuncu neyin neden olduğunu her zaman görebilir | "Neden?" günlükleri, önceden duyurulan olaylar, maç sonu Strateji Karnesi |
| Söz değerlidir | Diplomasi süs değil, kazanma aracıdır | Kristalin asıl kaynağı ticarettir; ihanetin kalıcı bedeli vardır |
| Farklı ama eşit | Dört halk farklı oynanır, hiçbiri üstün değildir | Ortak temel tablo + net sıfır puan bütçesi + simülasyon doğrulaması |
| Kimse "kötü" değil | Halklar ahlaken değil kültürel olarak ayrışır | Külboyları göçebe avcılardır, "karanlık ordu" değil |

### 1.3 Biçim: duraklatılabilir gerçek zamanlı

Oyun gerçek zamanlı akar, ancak oyuncu istediği an duraklatıp emir verebilir. Gerekçe: Age of Empires hissi korunur, ama dakikadaki tıklama sayısı belirleyici olmaktan çıkar. Nüfus sınırı **60**'tır; ordular küçük ve okunaklıdır.

### 1.4 Tempo kuralları

Dört çağ, barış süresi ve Anıt/Kalıntı koruma sürelerinin 30–40 dakikaya sığması için:

- Yiyecek ve odun toplama hızı klasik Age of Empires'a göre **yaklaşık %35 daha hızlıdır**; taş ve kristal bilerek daha yavaştır (bkz. 3.1).
- Çağ atlama araştırması kısadır: I→II **30 sn**, II→III **40 sn**, III→IV **45 sn**.
- Harita küçüktür: izci bir köşeden karşı köşeye yaklaşık 60 saniyede ulaşır.

| | Çırak (kolay) | Kâşif (normal) | Komutan (zor) |
|---|---|---|---|
| Barış süresi | 10 dk | 8 dk | 6 dk |
| Çağ II hedefi | ~6. dk | ~5. dk | ~4. dk |
| Çağ III hedefi | ~16–18. dk | ~13–15. dk | ~11–12. dk |
| Çağ IV hedefi | ~27–29. dk | ~22–24. dk | ~19–20. dk |
| En erken Anıt zaferi (2 dk inşa + 6 dk koruma) | ~37. dk | ~32. dk | ~28. dk |
| **Hedef maç süresi** | **35–45 dk** | **30–40 dk** | **25–35 dk** |

### 1.5 Bir maçın akışı (Kâşif zorluğu)

**Başlangıç.** Her taraf haritanın bir köşesinde şunlarla başlar: Ana Merkez, 4 köylü, seviye 1 kahraman, **1 ücretsiz izci**, 200 yiyecek, 200 odun, 100 taş. Harita savaş sisiyle kaplıdır.

**0–8. dk — Barış Süresi (hazırlık).**
- Kimse rakip birim ya da binaya hasar veremez. Ekranın üstünde barış sayacı görünür.
- Oyuncu köylü üretir, kaynak toplar, ev ve Kışla kurar; ~5. dakikada Kale Çağı'na geçer.
- İzci haritayı açar: komşuların yeri, kaynak yatakları, 5 Kadim Kalıntı ve tarafsız kamplar bulunur.
- Kahraman ve ilk askerler tarafsız yaratık kamplarında güvenli savaş pratiği yapar (kahraman barışta en fazla 3. seviyeye çıkar).
- Karşılaşılan halklarla ilk anlaşmalar yapılabilir.
- Kadim Kalıntılar bu sürede **uykudadır**; görülür ama ele geçirilemez.
- Son 60 saniyede boru sesi ve ekran uyarısı gelir.

**8–15. dk — İlk temas.**
- Kalıntılar uyanır; ilk kapışmalar kalıntılar ve sınır kaynakları üzerinedir.
- Yayılmacı yapay zekâ en zayıf komşusuna savaş ilan eder. Külboyları'nın güç zirvesi bu evrededir.
- İlk harita olayı duyurulur.
- ~13–15. dakikada Efsane Çağı: kuşatma, büyücüler ve özel birimler açılır.

**15–24. dk — Orta oyun.**
- Askeri İttifaklar kurulur, cepheler netleşir.
- Kristal ihtiyacı artar; ticaret anlaşmaları ve kalıntılar stratejik hale gelir.
- Surlar ve kaleler kuşatmayla aşılır. ~22–24. dakikada İmparatorluk Çağı.

**24–36. dk — Son oyun.**
- Bir taraf Büyük Anıt'a başlar ya da beş kalıntıyı toplar; geri sayım herkese görünür ve diğer herkes ona yönelir.
- Maç Fetih, Kalıntı ya da Anıt zaferiyle (tek başına ya da Ortak Zafer olarak) biter.

**Maç sonu.** Strateji Karnesi açılır (bkz. 5.4).

### 1.6 Çekirdek döngü

```
Topla → Kur/Üret → Keşfet → Karar ver (savaş / anlaş / çağ atla) → Sonucu gör → Yeniden planla
```

Her döngü 1–3 dakika sürer. "Sonucu gör" adımı, öğrenmenin gerçekleştiği yerdir; bu yüzden her önemli sonuç ekranda nedeniyle birlikte gösterilir.

### 1.7 Kazanma yolları

| Yol | Koşul | Geri sayım | Bozulursa |
|---|---|---|---|
| **Fetih** | Tüm rakiplerin Ana Merkezi yıkılır. Ana Merkezi yıkılan taraf 90 sn içinde yenisini kuramazsa elenir. | Yok | — |
| **Kalıntı** | 5 Kadim Kalıntı'nın tamamı **4 dk** kesintisiz elde tutulur. | Herkese görünür | Bir kalıntı kaybedilirse sayaç sıfırlanır |
| **Büyük Anıt** | Çağ IV'te Büyük Anıt inşa edilir (~2 dk) ve **6 dk** korunur. | Herkese görünür | Anıt yıkılırsa yeniden inşa gerekir |

Ortak Zafer kuralları 4.7'dedir.

---

## 2. Irklar ve Denge Tablosu

### 2.1 Dört halk

İsimler ve karakterler özgündür. Oyuncu birini seçer; kalan üçünü yapay zekâ yönetir.

| | **Sancaklılar** | **Yaprakdiller** | **Taşocaklılar** | **Külboyları** |
|---|---|---|---|---|
| Kimler | Ova krallıklarının insanları | Kadim ormanların halkı | Dağ içi ocakların ustaları | Bozkır ve volkan eteklerinin göçebeleri |
| Oyun tarzı | Dengeli; süvari ve ticaret | Menzil, hareket, pusu | Savunma, piyade, kuşatma | Kalabalık, hızlı, baskın |
| **Ekonomi bonusu** | Çiftlik verimi +%20 | Odun toplama +%20 | Taş ve kristal toplama +%20 (yalnızca normal madenlerde) | **Ganimet:** tarafsız kamplardan ve düşman kayıplarından kaynak |
| **Güçlü yön** | Süvari maliyeti −%10; eksik birim sınıfı yok | Okçu menzili +1; ormanda duran birimler saldırana dek görünmez | Bina canı +%20; piyade zırhı +1 | Birim maliyeti −%15, üretim süresi −%15 |
| **Zayıf yön** | Büyücü ve büyü teknolojileri +%20 pahalı; kristal toplama −%10 | Birim canı −%10; taş toplama −%15 | Hareket hızı −%10; süvari +%20 pahalı | Bina canı −%20; teknolojiler +%20 pahalı |
| **Özel birim** (Çağ III) | Sancak Süvarisi | Dal Gezgini | Kalkan Muhafızı | Kurt Binicisi |
| **Özel bina** (Çağ II) | Lonca Hanı | Yaşam Ağacı | Derin Ocak | Savaş Davulu Çadırı |
| Kahraman | Komutan Aldera | Korucu Sılven | Usta Durgan | Boy Beyi Karhan |
| Güç zirvesi | Orta oyun (15–24. dk) | Orta–geç oyun | Geç oyun (24. dk+) | Barış sonrası ilk saldırı (barışın bitiminden sonraki ~7 dk) |
| Doğal zafer yolu | Anıt ya da Ortak Zafer | Kalıntı | Anıt | Fetih |
| Varsayılan AI kişiliği | Tüccar | Fırsatçı | Onurlu Savunmacı | Yayılmacı |

### 2.2 Özel birimler

| Birim | Sınıf | Ne yapar | Zayıflığı |
|---|---|---|---|
| **Sancak Süvarisi** | Süvari | Çevresindeki dost birimlere +%10 saldırı hızı verir (auralar üst üste binmez) | Piyadeye karşı sıradan süvari kadar kırılgan |
| **Dal Gezgini** | Okçu | Yürürken ok atabilir; ormanda saldırırken de gizli kalır (diğer Yaprakdil birimleri saldırınca görünür olur) | Düşük can; süvari yakalarsa dayanamaz |
| **Kalkan Muhafızı** | Piyade | Okçuların piyadeye karşı üstünlük çarpanını ×1.5'ten ×1.0'a indirir | Çok yavaş; büyücü alan hasarına açık |
| **Kurt Binicisi** | Süvari | En hızlı birim; ekonomi binalarına ve kervanlara +%50 hasar | En düşük canlı süvari; piyade hattına giremez |

### 2.3 Özel binalar

| Bina | Kurallar |
|---|---|
| **Lonca Hanı** | Yürürlükteki her Ticaret Anlaşması için bir **Sancak Kervanı** çalıştırır: Sancaklılar o anlaşmadan %50 fazla kristal alır (12 yerine 18 kristal/dk) ve kervanları daha dayanıklıdır. Pazar takas oranını iyileştirir. Sancak Kervanı tam oyunda Ticaret Anlaşması'yla, MVP'de ise (Ticaret Anlaşması kapsam dışı olduğu için) Saldırmazlık Paktı'yla çalışır. |
| **Yaşam Ağacı** | Çevresindeki, savaşta olmayan dost birimleri yavaşça iyileştirir ve geniş görüş sağlar. Oyuncu başına en fazla 2. |
| **Derin Ocak** | Tükenmeyen taş/kristal madeni. Normal madene göre **%50 yavaş** toplar, en fazla **4 işçi** alır, oyuncu başına **1 adet** kurulur ve ırkın +%20 toplama bonusu burada **geçerli değildir**. Amacı zenginleştirmek değil, haritadaki madenler tükendiğinde tamamen kaynaksız kalmayı önlemektir. |
| **Savaş Davulu Çadırı** | Çevresindeki dost birimlere +%10 saldırı ve hareket hızı verir. Sökülüp taşınabilir (30 sn kurulum). Ucuz ve kırılgandır. Oyuncu başına en fazla 2. |

### 2.4 Kahramanlar

Ortak kurallar: Her halkın 1 kahramanı vardır ve maça onunla başlar. Seviye 1–10. Deneyim; savaştan, tarafsız kamplardan ve kalıntı ele geçirmekten gelir. Yetenekler 2, 4, 6 ve 8. seviyede açılır; 10. seviyede tüm yetenekler %20 güçlenir. Kahraman kalıcı olarak ölmez: yenildiğinde Ana Merkez'de `30 sn + seviye × 10 sn` sonra ücretsiz yeniden doğar. Barış süresinde en fazla 3. seviyeye çıkabilir.

| Kahraman | Sv. 2 (aktif) | Sv. 4 (pasif aura) | Sv. 6 (aktif) | Sv. 8 (nihai) |
|---|---|---|---|---|
| **Komutan Aldera** (Sancaklılar) | *Toplanma Borusu:* çevredeki birimler 10 sn +%20 hızlı | *Sancak Gölgesi:* çevreye +%10 hareket hızı (Sancak Süvarisi'nin saldırı hızı aurasıyla birlikte çalışır) | *Kalkan Duvarı:* 8 sn boyunca alınan hasar −%40 | *Büyük Hücum:* süvariler 6 sn durdurulamaz, ilk vuruş ×1.5 |
| **Korucu Sılven** (Yaprakdiller) | *Keskin Nişan:* tek hedefe yüksek hasar | *Orman Fısıltısı:* çevreye görüş +2, yakındaki gizli düşmanları açığa çıkarır | *Sarmaşık Tuzağı:* alanda yavaşlatma | *Ok Yağmuru:* geniş alan hasarı |
| **Usta Durgan** (Taşocaklılar) | *Yer Sarsan:* alanda 2 sn sersemletme | *Taş Deri:* çevreye zırh +1 | *Ocak Ateşi:* yakındaki binalar hızla onarılır, kuleler hızlı atar | *Dağın Öfkesi:* binalara ve kuşatmaya büyük hasar |
| **Boy Beyi Karhan** (Külboyları) | *Savaş Narası:* düşman hasarı 6 sn −%15 | *Sürü Ruhu:* yakındaki her 5 dost birim için +%2 hasar (en çok +%10) | *Akın:* kısa, hızlı hücum | *Kül Fırtınası:* alanda düşman görüşü kısılır ve yavaşlar |

### 2.5 "Tamamen eşit güç" nasıl sağlanır

**Adım 1 — Ortak temel.** Tüm halklar aynı birim, bina ve teknoloji tablosunu kullanır (bkz. 3. ve 4. bölüm). Farklar bu tablonun üzerine eklenen sınırlı sayıda değişikliktir.

**Adım 2 — Net sıfır puan bütçesi.** Her halk +10 puan avantaj ve −10 puan zayıflık alır.

| | Ekonomi bonusu | Güçlü yön | Özel birim | Özel bina | Zayıflık 1 | Zayıflık 2 | **Net** |
|---|---|---|---|---|---|---|---|
| Sancaklılar | +3 | +3 | +2 | +2 | −5 (büyü pahalı) | −5 (kristal −%10) | **0** |
| Yaprakdiller | +3 | +3 | +2 | +2 | −6 (can −%10) | −4 (taş −%15) | **0** |
| Taşocaklılar | +3 | +3 | +2 | +2 | −6 (hız −%10) | −4 (süvari pahalı) | **0** |
| Külboyları | +3 | +3 | +2 | +2 | −5 (bina canı −%20) | −5 (teknoloji pahalı) | **0** |

**Adım 3 — Simülasyonla doğrulama.** Puan bütçesi yalnızca başlangıç noktasıdır; ekonomi bonusları zamanla bileşik (kartopu) etki yarattığı için asıl ölçüt şudur:

- Yapay zekâ–yapay zekâ 1'e 1 eşleşme matrisinde her eşleşme **%45–55** kazanma oranında olmalı.
- Dörtlü maçlarda **her kazanma yolu için ayrı ayrı** hiçbir halkın payı **%35'i geçmemeli** (örneğin Anıt zaferlerinin tek halkta toplanmasını yakalamak için).
- Sınır aşılırsa önce sayılar, o yetmezse kural değiştirilir; halka yeni özellik eklenmez.

### 2.6 Kartopu önlemleri

**Külboyları ve Barış Süresi.** Erken baskın halkı, saldırının yasak olduğu 6–10 dakikada dezavantajlı kalmasın diye:

- Haritada **yeniden doğan tarafsız yaratık kampları** vardır ve barış süresinde de avlanabilir (bkz. 4.5).
- Kamplar herkese kahraman deneyimi verir; **kaynak ganimeti yalnızca Külboyları'na** düşer. Diğerleri çiftlik kurarken Külboyları avlanarak büyür ve barış bittiği an hazır bir orduyla çıkar.
- Ganimet kademe başına sabittir (bkz. 4.5) ve kamplar en fazla 3. kademeye kadar güçlenir; böylece gelir sınırsız büyümez.
- Barıştan sonra ganimet düşman kayıplarından da gelir: yenilen birimin maliyetinin %15'i, yıkılan binanın %20'si.

**Taşocaklılar ve "kapanıp Anıt basma".**

- Derin Ocak yavaş bir sigorta madenidir (bkz. 2.3).
- Büyük Anıt, Taşocaklılar'ın +%20 bina canı bonusundan **yararlanmaz**; tüm halklarda aynı cana sahiptir.
- Anıt geri sayımı herkese görünür ve tüm yapay zekâlar önceliğini Anıt'a çevirir (bkz. 4.9).
- −%10 hareket hızı, Taşocaklılar'ın haritadaki kalıntılara ve uzak madenlere yetişmesini zorlaştırır; içe kapanan Taşocaklı kristal bulmakta zorlanır.

---

## 3. Ekonomi ve Teknoloji Ağacı

### 3.1 Dört kaynak

| Kaynak | Nereden | Stratejik rolü | Köylü başına toplama |
|---|---|---|---|
| **Yiyecek** | Çalı, av, çiftlik (yenilenir) | Büyüme: köylü, piyade, süvari, çağ atlama | ~28/dk (çiftlik ~26/dk) |
| **Odun** | Ormanlar | Altyapı: binalar, çiftlik, okçu, kuşatma | ~28/dk |
| **Taş** | Az sayıda taş ocağı (tükenir) | Savunma: sur, kule, kale ve Büyük Anıt | ~22/dk |
| **Büyü Kristali** | Küçük kristal damarları, **ticaret**, kalıntılar, meteor yatakları | Güç: teknoloji, süvari, büyücü, ileri çağlar | ~18/dk |

Tasarım notları:

- Taş haritada bilerek kıttır ve sınır bölgelerine yerleştirilir; komşularla çekişme yaratır.
- Kristalin madenden gelen kısmı yetersizdir. Çağ III–IV için gereken kristalin büyük bölümü **ticaret anlaşmalarından ve kalıntılardan** gelir. Diplomasiyi değerli kılan temel mekanizma budur.
- Pazar'da kaynaklar birbirine çevrilebilir (100'e 70 oranında); bu, yanlış planlamayı telafi eden ama pahalı bir çıkış yoludur.
- Klasik Age of Empires'ta köylü başına ~20/dk olan yiyecek ve odun toplama hızı burada ~%35 artırılmıştır; taş ve kristal kıtlık yaratmak için daha yavaş toplanır.

Nüfus: Ana Merkez 10, her Ev +5 nüfus sağlar; üst sınır 60. Köylü, izci, piyade ve okçu 1, süvari ve büyücü 2, kuşatma 3 nüfus tutar; kahraman nüfus tutmaz.

### 3.2 Çağlar

| Çağ | Maliyet | Araştırma süresi | Ön koşul | Açtığı ana yenilik |
|---|---|---|---|---|
| **I. Kuruluş Çağı** | — | — | — | Ekonomi temeli, piyade, keşif |
| **II. Kale Çağı** | 400 yiyecek, 200 odun | 30 sn | 2 farklı Çağ I binası | Okçu, süvari, Pazar, surlar, özel bina, Demirci |
| **III. Efsane Çağı** | 700 yiyecek, 400 odun, 150 kristal | 40 sn | 2 farklı Çağ II binası | Kuşatma, büyücü, Kale, özel birim |
| **IV. İmparatorluk Çağı** | 1000 yiyecek, 600 taş, 500 kristal | 45 sn | Kale | Büyük Anıt, seçkin birimler, nihai teknolojiler |

### 3.3 Çağlara göre açılanlar

| | Binalar | Birimler | Teknolojiler |
|---|---|---|---|
| **I. Kuruluş** | Ana Merkez, Ev, Oduncu Kampı, Değirmen, Çiftlik, Maden Ocağı, Kışla, Gözcü Direği | Köylü, İzci, Piyade, Kahraman | Köylü taşıma kapasitesi I |
| **II. Kale** | Okçuluk Alanı, Ahır, Demirci, Pazar, Gözcü Kulesi, Ahşap Sur, **halka özel bina** | Okçu, Süvari | *Ekonomi:* El Arabası (taşıma +%25), Keskin Balta (odun +%15), Saban (çiftlik +%15), Kazma (maden +%15). *Askeri:* Silah I, Zırh I |
| **III. Efsane** | Kuşatma Atölyesi, Büyü Kulesi, Kale, Taş Sur | Kuşatma (mancınık), Büyücü, **halka özel birim** | Silah II, Zırh II, Uzun Yay (okçu menzili +1), Nal (süvari hızı +%10), Taş Duvarcılık (bina canı +%15), Kervan Yolları (ticaret geliri +%20), Kadim Bilgi (kahraman deneyimi +%25) |
| **IV. İmparatorluk** | **Büyük Anıt** | Seçkin özel birim (yükseltme) | Silah III, Zırh III, Büyü Odağı (büyücü alanı genişler), Usta Mimarlık (inşa hızı +%25) |

**Büyük Anıt:** 800 odun, 1000 taş, 600 kristal. 8 köylüyle yaklaşık 2 dakikada biter. Canı tüm halklarda aynıdır. Oyuncu başına aynı anda 1 adet.

### 3.4 Temel birim tablosu

Tüm halklar için ortaktır; halk bonusları bunun üzerine uygulanır.

| Birim | Çağ | Maliyet | Can | Hasar | Menzil | Hız | Üretim | Nüfus |
|---|---|---|---|---|---|---|---|---|
| Köylü | I | 50 yiyecek | 25 | 3 | Yakın | Orta | 15 sn | 1 |
| İzci | I | İlki ücretsiz; sonrakiler 60 yiyecek | 30 | — (savaşamaz) | — | Çok hızlı | 15 sn | 1 |
| Piyade | I | 50 yiyecek, 20 odun | 60 | 7 | Yakın | Orta | 18 sn | 1 |
| Okçu | II | 25 yiyecek, 45 odun | 35 | 6 | 5 | Orta | 20 sn | 1 |
| Süvari | II | 80 yiyecek, 25 kristal | 90 | 9 | Yakın | Hızlı | 25 sn | 2 |
| Kuşatma | III | 150 odun, 100 taş | 120 | 14 (binalara ×3.0 ile 42) | 7 | Yavaş | 40 sn | 3 |
| Büyücü | III | 60 yiyecek, 80 kristal | 40 | 12 (alan) | 5 | Orta | 35 sn | 2 |

**İzci.** Tüm halklarda aynı değerlere sahiptir; yalnızca görünümü halka özgüdür. "Otomatik keşfet" düğmesi vardır. **Tarafsız kamplar izciye saldırmaz**, ayrıca otomatik keşif rotası kampların etrafından dolaşır. İzci yalnızca barış bittikten sonra, rakip birimler tarafından yenilebilir.

### 3.5 Ekonomide öğretilen ikilemler

| İkilem | Oyuncunun sorusu |
|---|---|
| Köylü mü, asker mi? | Barış bitmeden kaç köylüm, kaç askerim olmalı? |
| Şimdi mi, sonra mı? | Kaynağımı orduya mı harcayayım, çağ atlamak için mi biriktireyim? |
| Kendim mi, ticaretle mi? | Kristali uzaktaki damardan mı toplayayım, komşuyla anlaşarak mı alayım? |
| Sur mu, Anıt mı? | Kıt taşı savunmaya mı, zafere mi ayırayım? |

---

## 4. Savaş ve Diplomasi Kuralları

### 4.1 Savaş üçgeni

```
Piyade  ──üstün──▶  Süvari  ──üstün──▶  Okçu  ──üstün──▶  Piyade
```

Üstün olan taraf **×1.5**, zayıf olan taraf **×0.75** hasar verir.

| Saldıran ↓ / Savunan → | Piyade | Okçu | Süvari | Kuşatma | Büyücü | Bina |
|---|---|---|---|---|---|---|
| **Piyade** | ×1.0 | ×0.75 | **×1.5** | ×1.0 | ×1.0 | ×0.5 |
| **Okçu** | **×1.5** | ×1.0 | ×0.75 | ×1.0 | ×1.0 | ×0.25 |
| **Süvari** | ×0.75 | **×1.5** | ×1.0 | **×1.5** | **×1.5** | ×0.5 |
| **Kuşatma** | Alan, yavaş mermi | Alan, yavaş mermi | ×0.5 (hızlı hedefi ıskalar) | ×1.0 | ×1.0 | **×3.0** |
| **Büyücü** | Alan ×1.0 | Alan ×1.0 | ×0.75 | ×1.0 | ×1.0 | ×0.5 |

Dördüncü köşe — **Kuşatma ve Büyü:** Binalara ve kümelenmiş piyade/okçu gruplarına karşı güçlüdür; hızlı süvari baskınına karşı savunmasızdır. Bu yüzden kuşatma piyadeyle korunmalı, düşman kuşatması süvariyle avlanmalıdır.

**Arayüz kuralı.** Oyuncu bir birim seçip düşmanın üzerine geldiğinde yeşil yukarı ok (üstünsün), gri çizgi (denk) ya da kırmızı aşağı ok (zayıfsın) görür. Renk körlüğü için şekil ve renk birlikte kullanılır.

### 4.2 Savaş sisi

- Keşfedilmemiş alan siyah, keşfedilip şu an görülmeyen alan gri (binalar son görüldüğü haliyle) görünür.
- Görüş sağlayanlar: birimler, binalar, Gözcü Direği/Kulesi, Yaşam Ağacı, müttefik görüşü (yalnızca Askeri İttifak'ta).
- Ormandaki Yaprakdil birimleri saldırana dek görünmez; kuleler ve kahramanlar onları yakın mesafede açığa çıkarır.

### 4.3 Barış Süresi kuralları

| | Barışta | Barıştan sonra |
|---|---|---|
| Rakip birim/binaya hasar | Verilemez | Verilebilir |
| Tarafsız kamplara saldırı | Serbest | Serbest |
| Keşif, rakip üssü görme | Serbest | Serbest |
| Anlaşma yapma | Serbest | Serbest |
| Kadim Kalıntı ele geçirme | Kalıntılar uykuda | Serbest |
| Harita olayları | Yok | Var |

### 4.4 Kadim Kalıntılar

Haritada 5 kalıntı vardır: komşu üsler arasındaki dört ara bölgede birer tane ve merkezde **Kadim Harabe**. Bir kalıntı, yanında 20 saniye boyunca rakipsiz birim tutularak ele geçirilir.

| Kalıntı | Sürekli bonus |
|---|---|
| Hasat Taşı | +8 kristal/dk, çiftlik verimi +%10 |
| Orman Taşı | +8 kristal/dk, odun toplama +%10 |
| Demir Taşı | +8 kristal/dk, tüm birimlere zırh +1 |
| Rüzgâr Taşı | +8 kristal/dk, hareket hızı +%5 |
| **Kadim Harabe** (merkez) | +15 kristal/dk, kahraman deneyimi +%50, 3 dakikada bir *Kadim Görü* (tüm harita 15 sn açılır) |

### 4.5 Tarafsız yaratık kampları

- Haritada 8 kamp bulunur: her başlangıç bölgesinin yakınında birer, ara bölgelerde dört.
- Temizlenen kamp **3 dakika sonra bir kademe güçlenerek** yeniden doğar. **Üst sınır 3. kademedir**; sonraki doğuşlarda 3. kademede kalır, böylece geç oyunda da temizlenebilir.
- Kamplar üslerine yaklaşılmadıkça saldırmaz ve izcilere hiç saldırmaz.
- Herkese kahraman deneyimi verir. Kaynak ganimeti yalnızca Külboyları'na düşer:

| Kademe | Yaklaşık güç | Külboyları ganimeti |
|---|---|---|
| 1 | Kahraman + 3 piyade ile temizlenir | 60 yiyecek, 40 odun |
| 2 | Küçük karma ordu gerekir | 100 yiyecek, 60 odun, 20 kristal |
| 3 (tavan) | Orta boy ordu gerekir | 150 yiyecek, 80 odun, 40 kristal |

### 4.6 Dinamik harita olayları

Barış bittikten sonra aralıklarla tek bir olay tetiklenir. Her olay **30–45 saniye önceden** duyurulur; oyuncu hazırlanmak için zaman bulur. Aynı anda iki olay olmaz.

| Olay | Etki | Süre | Oyuncuya düşündürdüğü | Karşı hamle |
|---|---|---|---|---|
| **Kuraklık** | Çiftlik verimi −%40 | 2 dk | Tek kaynağa bağlı kalma | Yiyecek stoku, av, Pazar takası |
| **Meteor Yağmuru** | İşaretli bölgeye düşer, hasar verir; ardından 600 kristallik yatak bırakır | Anlık | Risk ve ödül | Bölgeyi boşalt, sonra yatağı ilk sen tut |
| **Yaratık Baskını** | Tarafsız sürü, güç puanı (sahip olunan birim ve binaların toplam maliyeti) en yüksek tarafın sınırına saldırır | ~90 sn | Önde olmanın da bedeli var | Sur, kule, orduyu geri çek |
| **Gezgin Kervan** | Merkeze tarafsız tüccar gelir; her taraf bir kez avantajlı takas yapar | 2 dk | Fırsatı değerlendirme | Merkeze güvenli yol aç |
| **Sis Gecesi** | Tüm görüş −%40 | 90 sn | Bilginin değeri | Kule ve izciyle sınırı izle; pusuya dikkat |

Yaratık Baskını bilerek lideri hedefler: geride kalana nefes aldıran bir dengeleme mekanizmasıdır.

### 4.7 Diplomasi

**İki gösterge.**

| Gösterge | Aralık | Ne ölçer | Kimler görür |
|---|---|---|---|
| **İlişki** | −100 … +100 | İki taraf arasındaki ikili durum | İlgili iki taraf |
| **Güvenilirlik Puanı** | 0 … 100 (başlangıç 60) | Bir tarafın sözünü tutma geçmişi | Herkes |

**Üç anlaşma.**

| Anlaşma | Koşul | Etki | Süre | Dürüst fesih |
|---|---|---|---|---|
| **Ticaret Anlaşması** | İki tarafta da Pazar; İlişki ≥ 0 | İki Pazar arasında görünür kervan gidip gelir; her iki tarafa +12 kristal/dk; İlişki dakikada +1. Kervan, taraflardan biriyle savaşan üçüncü taraflarca vurulabilir. | Süresiz | Anında; ceza yok |
| **Saldırmazlık Paktı** | İlişki ≥ +20; Güvenilirlik ≥ 30 | Taraflar birbirine saldırmamayı taahhüt eder | 5 dk, yenilenebilir | 60 sn önceden bildirim; Güvenilirlik −5 |
| **Askeri İttifak** | İki taraf da Çağ II+; İlişki ≥ +50; Güvenilirlik ≥ 50 | Ortak görüş, yardım çağrısı, Ortak Zafer. **En fazla 1 müttefik.** | Süresiz | 60 sn önceden bildirim; Güvenilirlik −10 |

"En fazla 1 müttefik" kuralı haritada en kalabalık dengeyi 2'ye 2 yapar; oyuncunun üç yapay zekâyı birden yanına alıp oyunu anlamsızlaştırmasını ya da üçe bir kalmasını engeller.

**Başlangıç İlişkisi.** İki taraf arasındaki İlişki, tarafların kişilik eğilimlerinin toplamıyla başlar: Tüccar +25, Fırsatçı +10, Onurlu Savunmacı 0, Yayılmacı −10, oyuncu 0. Örneğin oyuncu–Tüccar +25 ile başlar ve hemen pakt yapabilir; oyuncu–Yayılmacı −10 ile başlar ve önce hediyeyle İlişkiyi yükseltmek gerekir.

**Savaş ilanı.** Aralarında pakt ya da ittifak olmayan bir tarafa barıştan sonra saldırmak ihanet değildir; ilk saldırı otomatik olarak savaş ilanı sayılır. Güvenilirlik değişmez, yalnızca o tarafla İlişki −40 olur. Yalnızca Ticaret Anlaşması olan bir tarafa saldırmak da savaş ilanıdır: anlaşma sona erer ve ek olarak Güvenilirlik −10 olur.

**İhanet.** Yürürlükteki bir pakt ya da ittifak varken bildirimsiz saldırmaktır. Kazara ihaneti önlemek için oyun onay ister: *"Bu bir ihanet olacak ve herkes bunu bilecek. Emin misin?"*

| İhanet | Güvenilirlik | İlişki (mağdur) | İlişki (diğer herkes) | Ek sonuç |
|---|---|---|---|---|
| Saldırmazlık Paktı'nı çiğnemek | −25 | −80 | −30 | 5 dk "Hain" damgası: yeni anlaşma yapılamaz |
| Askeri İttifak'ı çiğnemek | −40 | −80 | −30 | 5 dk "Hain" damgası |
| Güvenilirlik **25'in altına** düşerse | | | | **Koalisyon:** diğer taraflar kendi aralarında pakt yapar ve 5 dk boyunca haini öncelikli hedef alır |

**Güvenilirliği geri kazanmak** yavaştır ve emek ister:

| Davranış | Güvenilirlik |
|---|---|
| Yürürlükte anlaşma varken geçen her dakika | +1 |
| Bir paktı süresinin sonuna kadar tutmak | +5 |
| Müttefikin yardım çağrısına karşılık vermek | +5 |
| Hediye göndermek (3 dakikada en çok bir kez sayılır) | +3 |

**İlişkiyi değiştirenler:** hediye (gönderilen her 20 kaynak için +1; 3 dakikada en çok +15), ortak düşmana karşı savaşmak (+10), yardım çağrısına gelmek (+15) ya da gelmemek (−10), sınıra ordu yığmak (−5), elindeki kalıntıyı almak (−10).

**"Neden?" günlüğü.** Her İlişki ve Güvenilirlik değişimi ekranda kısa bir gerekçeyle belirir ve diplomasi panelinde listelenir. Örnek: *"Güvenilirlik −40 — Müttefikine haber vermeden saldırdın."* Yapay zekâlar da aynı kurallara tabidir; ihanet eden yapay zekâ da aynı cezayı alır.

**Ortak Zafer.**

- Hayatta kalan tüm taraflar Askeri İttifak içindeyse maç anında **Ortak Zafer** ile biter; müttefikler birbirine dönmek zorunda değildir.
- Kalıntılar müttefikler arasında ortak sayılır; Anıt'ı koruyan tarafın müttefiki de kazanır.
- **Tek başına zafer** isteyen, son rakip düşmeden önce ittifaktan çıkmalıdır: 60 sn bildirimle (dürüst) ya da ihanetle.
- Fırsatçı yapay zekâ müttefik de aynısını yapabilir ve bunu önceden belli eder; Onurlu Savunmacı asla yapmaz.
- Strateji Karnesi iki sonucu ayrı rozetle gösterir (*Sadık Müttefik* / *Tek Sancak*). İkisi de geçerli zaferdir; oyun hangisinin "daha iyi" olduğunu söylemez.

### 4.8 Yapay zekâ kişilikleri

Varsayılan olarak her kişilik bir halka bağlıdır (bkz. 2.1); oyuncu hangi halkı seçerse kalan üç kişilik haritada yer alır. "Sürpriz Kişilikler" seçeneği eşleşmeyi karıştırır.

| | **Tüccar** | **Yayılmacı** | **Fırsatçı** | **Onurlu Savunmacı** |
|---|---|---|---|---|
| Barışta | Pazar'a koşar, herkese ticaret teklif eder | Ordu biriktirir, sınırı genişletir | Herkesi keşfeder, kalıntıların yerini öğrenir | Sur ve kule kurar |
| Savaşa girme nedeni | Yalnızca saldırıya uğrarsa ya da kervanı vurulursa | Barış biter bitmez en zayıf komşu | Başkasıyla savaşan ya da zayıflayan taraf | Yalnızca saldırıya uğrarsa ya da müttefiki çağırırsa |
| Anlaşmaya yatkınlık | Çok yüksek | Düşük; yalnızca kaybederken pakt ister | Orta; işine geldiği sürece | Yavaş güvenir, güvenince çok sadık |
| İhanet eder mi | Hayır | Hayır; saldırmadan önce açıkça fesheder | **Evet**, güç oranı lehineyse; önceden işaret verir | Asla |
| Hedeflediği zafer | Büyük Anıt | Fetih | Kalıntı | Büyük Anıt ya da Ortak Zafer |
| İhanete tepkisi | İki kat sert; haine ticareti keser | Umursamaz; zayıfsa saldırır | Haini fırsat olarak görür | En uzun hafıza; bir daha asla anlaşmaz |
| Oyuncuya öğrettiği | İş birliği kazandırır | Savunma hazırlığı, tehdidi okumak | Güvenin sınırı, işaretleri okumak | Sadakatin karşılığı |

**Fırsatçı'nın işaretleri.** İhanetten yaklaşık 45 saniye önce: sınıra asker yığar, diplomasi panelindeki ruh hali göstergesi "Şüpheli"ye döner ve (Çırak ve Kâşif'te) danışman uyarır. Amaç oyuncuyu şaşırtmak değil, işaretleri okumayı öğretmektir.

**Görünürlük.** Her yapay zekânın diplomasi panelinde bir ruh hali ikonu (Dostane / Nötr / Şüpheli / Düşman) ve tek satırlık gerekçesi bulunur.

### 4.9 Yapay zekâ tepki tablosu

| Durum | Tüccar | Yayılmacı | Fırsatçı | Onurlu Savunmacı |
|---|---|---|---|---|
| Biri Büyük Anıt'a başladı | Ticareti keser, saldırıya katılır | Tüm orduyla Anıt'a yürür | Anıt sahibinin zayıf kanadına vurur | Müttefiki değilse saldırıya katılır |
| Biri 4 kalıntı tutuyor | En yakın kalıntıyı geri almaya çalışır | Lideri hedef alır | Savunması en zayıf kalıntıya gider | Kendi kalıntısını tahkim eder |
| Oyuncu ihanet etti | İlişkiyi keser, koalisyona girer | Oyuncu zayıfsa saldırır | Oyuncuya karşı paktlara katılır | Koalisyona girer, kalıcı olarak küser |
| Oyuncu açık ara önde | Diğerleriyle pakt arar | Oyuncuya saldırmak yerine pakt ister | Oyuncuya karşı ittifak arar | Savunmayı artırır |
| Oyuncu çok zayıf | Ticaret ve hediye teklif eder | Saldırır | Saldırır | Koruma amaçlı pakt teklif edebilir |
| Kuraklık duyuruldu | Yiyecek takası teklif eder | Yağma için saldırıyı öne çeker | Zor durumdakine baskı yapar | Stok yapar |

Yapay zekâ kararları kural ve fayda puanı tabanlıdır; kişilik, aynı durumlara verilen ağırlıkları değiştirir. Yapay zekâ hiçbir zorlukta kaynak hilesi yapmaz ve savaş sisinin arkasını göremez.

---

## 5. 10–15 Yaş İçin Öğrenme ve Eğlence Dengesi

### 5.1 İlke

Oyun ders vermez; öğrenme, kararın sonucunu görmekten gelir. Soru-cevap, sınav ya da "doğru cevap" ekranı yoktur. Oyunun görevi, sonuçları **görünür ve anlaşılır** kılmaktır.

### 5.2 Zorluk ayarları

| Ayar | Çırak | Kâşif | Komutan |
|---|---|---|---|
| Barış süresi | 10 dk | 8 dk | 6 dk |
| Hedef maç süresi | 35–45 dk | 30–40 dk | 25–35 dk |
| Başlangıç kaynağı | +%25 | Standart | Standart |
| Yapay zekâ karar aralığı | 30 sn | 20 sn | 10 sn |
| Yapay zekâ hataları | Bilerek yapar (yanlış karşı birim, boşta köylü) | Ara sıra | Yapmaz |
| Yapay zekâ kaynak hilesi | Yok | Yok | Yok |
| Danışman | Etkin ipucu verir | Soru sorar | Yalnızca istenince |
| Harita olayı sıklığı | 6–8 dk | 4–6 dk | 3–5 dk |
| "Köylü üretimini sürdür" | Varsayılan açık | Kapalı (açılabilir) | Kapalı (açılabilir) |
| İhanet öncesi uyarı | Danışman + görsel işaret | Danışman + görsel işaret | Yalnızca görsel işaret |
| Duraklatma | Sınırsız | Sınırsız | Sınırsız |

Zorluk, yapay zekâya haksız avantaj vererek değil; karar kalitesi, tempo ve yardım düzeyi değiştirilerek ayarlanır. Çocuk "hile yapıyor" duygusuna kapılmamalıdır.

### 5.3 Mikro-yönetim azaltıcılar

10–12 yaş grubunu yoran şey karar değil, tekrar eden tıklamadır. Bu yüzden:

- **Boşta köylü ikonu.** Boşta köylü varsa ekranda sayısıyla birlikte belirir; tıklayınca sıradaki boşta köylüye gider.
- **Otomatik kaynak geçişi.** Kaynak tükendiğinde köylü en yakın aynı tür kaynağa kendiliğinden geçer; yoksa boşta ikonuna düşer.
- **"Köylü üretimini sürdür" anahtarı.** Ana Merkez, kaynak ve nüfus elverdikçe köylü üretmeye devam eder.
- **Toplanma noktası.** Yeni köylüler doğrudan seçilen kaynağa, yeni askerler seçilen noktaya gider.
- **Tek tuşla ordu.** "Tüm askerleri seç" ve "kahramanı seç" tuşları.
- **Otomatik keşif.** İzci kendi başına haritayı açar; kamplara girmez.
- **Danışman hatırlatmaları (Çırak).** 20 saniyeden uzun boşta kalan köylü ve dolan nüfus sınırı hatırlatılır.
- **Yanlış tıklama koruması.** İhanet ve Ana Merkez yıkma gibi geri dönüşü olmayan işlemler onay ister.

### 5.4 Geliştirilen beceriler

| Beceri | Onu çalıştıran mekanik | Strateji Karnesi'nde görünen |
|---|---|---|
| **Kaynak yönetimi** | Dört kaynak, kıt taş ve kristal, nüfus sınırı | Kaynak grafiği, boşta köylü süresi, harcanmayan stok |
| **Uzun vadeli planlama** | Barış süresine hazırlık, çağ atlama, Anıt | Çağ atlama zamanları, barış bittiğindeki ordu/ekonomi durumu |
| **Kriz çözme** | Önceden duyurulan olaylar, baskınlar, ihanet | Her olaydan önceki ve sonraki durum |
| **Diplomasi** | Üç anlaşma, Güvenilirlik, kişilikli yapay zekâlar | Anlaşma zaman çizelgesi, Güvenilirlik grafiği |
| **Neden-sonuç ilişkisi** | "Neden?" günlükleri, savaş üçgeni göstergeleri | "Dönüm noktaları": maçı değiştiren 3–5 an |
| **Bilgi toplama** | Savaş sisi, izci, işaretleri okuma | Barış sonunda keşfedilen harita yüzdesi |
| **Risk değerlendirme** | Meteor yatağı, kalıntılar, erken çağ atlama | Alınan risklerin sonucu |

**Strateji Karnesi.** Maç sonunda açılır; not ya da puan vermez. Üç bölümü vardır: (1) dört kaynağın zaman grafiği, (2) dönüm noktaları zaman çizelgesi, (3) danışmandan tek bir düşündürücü soru (örneğin *"12. dakikada yiyeceğin bitti. O sırada köylülerin neredeydi?"*). Karne cihazda kalır.

**Danışman.** Halka özgü bir yardımcı karakterdir. Emir vermez, soru sorar: *"Rakibin okçu yığıyor. Okçulara karşı en iyi kim dayanır?"*

### 5.5 Öğretici: beş kısa görev

| # | Görev | Öğrettiği | Süre |
|---|---|---|---|
| 1 | İlk Ocak | Köylü, dört kaynak, ev, nüfus | ~5 dk |
| 2 | Sisin Ardı | İzci, savaş sisi, kamp, kahraman | ~5 dk |
| 3 | Üç Silah | Savaş üçgeni ve göstergeleri | ~6 dk |
| 4 | Verilen Söz | Pakt, Güvenilirlik, ihanetin sonucu (oyuncu ihaneti deneyip sonucu görebilir) | ~8 dk |
| 5 | Kurak Yaz | Kriz: kuraklık ve baskın aynı maçta | ~8 dk |

### 5.6 Eğlenceyi koruyan kararlar

- **Kaybetmek öğretici ama ezici değil.** Elenen oyuncu Karne'yi görür ve "aynı haritada yeniden dene" seçeneği alır.
- **Geriden gelme şansı.** Yaratık Baskını lideri hedefler; yapay zekâlar açık ara öndeki tarafa karşı birleşmeye yatkındır.
- **Her halk bir fantezi.** İmza mekanikleri yüzdelik bonustan ibaret değildir; ekranda görülür ve hissedilir.
- **Kısa oturum.** Maç 25–45 dk; oyun her an kaydedilebilir.

### 5.7 Yaşa uygunluk ve güvenlik

- Şiddet soyuttur: kan yoktur, yenilen birimler geri çekilip kaybolur.
- Çevrimiçi sohbet, çok oyunculu mod, reklam ve oyun içi satın alma yoktur.
- Kişisel veri toplanmaz; kayıtlar ve Karne cihazda tutulur.
- Okuma yükü düşüktür: ikon + kısa metin; tüm kritik bilgiler renk yanında şekille de verilir.
- Halklar ahlaki olarak eşittir; hiçbir halk "kötü" olarak sunulmaz.

---

## 6. İlk Prototip (MVP) Önerisi

Öneri iki adımlıdır: önce ucuz bir kâğıt prototiple **eğlenceyi ve anlaşılırlığı**, sonra dijital MVP ile **gerçek zamanlı akışı ve yapay zekâyı** sınamak.

### 6.1 Adım 1 — Kâğıt prototip (1–2 hafta)

**Amaç:** Kod yazmadan önce çekirdek kuralların 10–15 yaş için anlaşılır ve eğlenceli olup olmadığını görmek.

| Bileşen | İçerik |
|---|---|
| Harita | Kareli karton; 2–3 başlangıç köşesi, ortada 1 kalıntı |
| Kaynak | 3 renk jeton (yiyecek, odun, kristal) |
| Birimler | Piyade, okçu, süvari kartları; köylü pulları |
| Halklar | Sancaklılar ve Külboyları (birer imza kuralıyla) |
| Akış | Sıra tabanlı; ilk 4 tur barış |
| Diplomasi | Yapay zekâ rolünü bir yetişkin, kişilik kartına göre oynar |
| Zafer | Fetih ya da kalıntıyı 3 tur tutmak |

**Test:** 3–5 çocukla, 30–40 dakikalık oturumlar. Bakılacak sorular: Savaş üçgenini kendileri keşfedebiliyorlar mı? Barış turlarında ne yapıyorlar? Anlaşma teklif etmeyi kendiliğinden düşünüyorlar mı? İhanetin sonucunu adil buluyorlar mı?

### 6.2 Adım 2 — Dijital MVP

**Teknoloji önerisi:** TypeScript + Phaser 3 + Vite, web tarayıcıda. Kurulum gerektirmez; test için bağlantı paylaşmak yeterlidir.

**Mimari ilkeler:**
- Birim, bina ve halk değerleri kodda değil **veri dosyalarında** (JSON) tutulur; denge ayarı kod değiştirmeden yapılır.
- Oyun simülasyonu görüntüden ayrı ve deterministik yazılır; böylece yapay zekâ–yapay zekâ maçları ekransız, hızlı koşturularak 2.5'teki denge ölçütleri sınanabilir.

**Kapsam:**

| Alan | MVP'de var |
|---|---|
| Harita | 1 sabit harita; oyuncu + 2 yapay zekâ |
| Halklar | Sancaklılar ve Külboyları. Yapay zekâlardan biri Sancaklılar (Tüccar), diğeri Külboyları'dır (Yayılmacı); oyuncuyla aynı halkı oynayan taraf renkle ayırt edilir. |
| Kaynak | Yiyecek, odun, kristal (sur ve Anıt kapsam dışı olduğu için taş yok). Başlangıç: 200 yiyecek, 200 odun. |
| Çağlar | I ve II |
| Birimler | Köylü, izci, piyade, okçu, süvari; yeteneksiz kahraman |
| Sistemler | Savaş sisi, barış sayacı, savaş üçgeni göstergeleri, duraklatma ve hız |
| Tarafsız kamplar | Yeniden doğan, en fazla 3 kademe; izciye saldırmaz |
| Diplomasi | İlişki (başlangıç değerleri ve hediye dahil), Saldırmazlık Paktı, Güvenilirlik Puanı, ihanet ve onay penceresi, "Neden?" günlüğü |
| Yapay zekâ | 2 kişilik: Tüccar ve Yayılmacı. Tüccar MVP'de Ticaret Anlaşması yerine Saldırmazlık Paktı teklif eder ve Anıt yerine Kadim Harabe'yi hedefler. |
| Hedef | Kadim Harabe (tek kalıntı) |
| Zafer | Fetih ya da Kadim Harabe'yi 3 dk tutmak |
| Kolaylıklar | Boşta köylü ikonu, otomatik kaynak geçişi, otomatik keşif |
| Zorluk | Yalnızca Kâşif |

**Halk hissi — zorunlu kapsam.** Özel birim ve binalar MVP'de yoktur; bu yüzden iki halkın farkı yüzdelik bonusla bırakılmaz. Her birine ekranda görülen bir imza mekaniği verilir:

- **Külboyları — Ganimet Yağması.** Kamp temizlenince kaynaklar görsel ve sesli bir patlamayla anında düşer. Oyuncu çiftlik yerine avlanarak büyür.
- **Sancaklılar — Sancak Kervanı.** Yürürlükteki her pakt için iki üs arasında gidip gelen, haritada görünen bir kervan pakt başına **18 kristal/dk** getirir (denge ayarından sonra MVP'de 3; kamp ganimeti de MVP'de tablonun 0,4 katıdır; bkz. [denge raporu](denge-raporu.md)); MVP'de bunun için bina gerekmez. Oyuncu anlaşarak büyür; pakt bozulursa kervan durur. Sancak Kervanı tam oyunda Ticaret Anlaşması'yla, MVP'de ise (Ticaret Anlaşması kapsam dışı olduğu için) Saldırmazlık Paktı'yla çalışır.

**Kapsam dışı (sonraya):** Çağ III–IV, taş, kuşatma ve büyücü, sur ve kuleler, harita olayları, Büyük Anıt, Ticaret Anlaşması ve Askeri İttifak, kahraman yetenekleri, özel birim ve özel binalar, Yaprakdiller ve Taşocaklılar, diğer zorluklar, öğretici görevler, tam Strateji Karnesi.

### 6.3 Başarı ölçütleri

En az 8 çocukla (10–15 yaş) yapılacak oyun testinde:

| Ölçüt | Hedef |
|---|---|
| Maç süresi | ≤ 30 dk |
| Bir maçtan sonra savaş üçgenini kendi cümleleriyle açıklayabilen | ≥ %70 |
| Yönlendirilmeden diplomasi kullanan | ≥ %50 |
| İki halkı da oynadıktan sonra aralarındaki farkı anlatabilen | ≥ %70 |
| "Bir daha oynamak isterim" diyen | ≥ %70 |
| Yapay zekâ–yapay zekâ simülasyonunda Sancaklılar–Külboyları kazanma oranı | %45–55 |

### 6.4 Geliştirme sırası

1. **Hareket ve ekonomi:** harita, köylü, toplama, bina, nüfus, boşta köylü ikonu.
2. **Savaş ve sis:** üç birim, üçgen çarpanları ve göstergeleri, savaş sisi, izci, kamplar.
3. **Kural çatısı:** barış sayacı, Çağ II, Kadim Harabe, iki zafer yolu, imza mekanikleri.
4. **Yapay zekâ ve diplomasi:** iki kişilik, pakt, Güvenilirlik, ihanet, "Neden?" günlüğü.
5. **Oyun testi ve denge:** çocuklarla test, ekransız simülasyon, sayı ayarı.

### 6.5 Riskler

| Risk | Önlem |
|---|---|
| Kapsam kayması | 6.2'deki "kapsam dışı" listesi bağlayıcıdır; yeni özellik ancak bir başka özellik çıkarılarak eklenir |
| Yol bulma ve birim çarpışması karmaşıklığı | Karo tabanlı harita, küçük ordular, basit A* |
| Yapay zekânın aptal ya da yenilmez görünmesi | Kural tabanlı, kişilik ağırlıklı karar; her kararın gerekçesi panelde görünür |
| Diplomasinin göz ardı edilmesi | Sancak Kervanı ve kristal kıtlığı diplomasiyi kârlı kılar; test ölçütü olarak izlenir |
| Barış süresinin sıkıcı olması | İzci, kamp avı, kahraman seviyesi ve görünür sayaç |

---

## Ekler

### Ek A — Sözlük

| Terim | Açıklama |
|---|---|
| Barış Süresi | Maçın başında rakiplere saldırının yasak olduğu hazırlık evresi |
| Güvenilirlik Puanı | Bir tarafın sözünü tutma geçmişini gösteren, herkese açık 0–100 arası değer |
| İlişki | İki taraf arasındaki −100 … +100 arası ikili durum |
| İhanet | Yürürlükteki pakt ya da ittifak varken bildirimsiz saldırı |
| Koalisyon | Güvenilirliği 25'in altına düşen tarafa karşı diğerlerinin geçici birliği |
| Kadim Kalıntı | Ele geçirene sürekli bonus veren 5 harita hedefinden biri |
| Kadim Harabe | Merkezdeki en güçlü kalıntı |
| Ganimet | Külboyları'nın kamplardan ve düşman kayıplarından kaynak kazanması |
| Sancak Kervanı | Sancaklılar'ın anlaşmalardan ek kristal getiren görünür kervanı |
| Derin Ocak | Taşocaklılar'ın yavaş ama tükenmeyen sigorta madeni |
| Ortak Zafer | Hayatta kalan tüm tarafların müttefik olmasıyla biten maç |
| Strateji Karnesi | Maç sonunda kararları ve sonuçlarını gösteren, not vermeyen özet |

### Ek B — Açık tasarım soruları

1. **Süre sınırı:** Çok uzayan maçlar için 50. dakikada puanla biten bir "Günbatımı" kuralı gerekli mi?
2. **Kişilik–halk bağı:** Varsayılan sabit eşleşme mi, yoksa ilk maçtan itibaren karışık mı daha iyi öğretir?
3. **Harita çeşitliliği:** Tek simetrik harita mı, yoksa simetriyi koruyan rastgele üretim mi?
4. **Kahramanın barıştaki seviye sınırı:** 3. seviye sınırı Külboyları'nın kamp avını yeterince ödüllendiriyor mu?
5. **Dokunmatik:** Tablet desteği MVP sonrasında hedeflenecek mi? Arayüz buna göre mi tasarlanmalı?
6. **Seslendirme:** Danışman ve "Neden?" günlükleri sesli okunmalı mı (10–11 yaş için okuma yükünü azaltır)?
7. **Sancaklılar'ın kristal zayıflığı:** Kristalin çoğu madenden değil ticaretten geldiği ve Lonca Hanı ticaret gelirini artırdığı için "kristal toplama −%10" pratikte −5 puan kadar hissedilmeyebilir. Simülasyonda Sancaklılar güçlü çıkarsa bu zayıflık −%20'ye çıkarılır ya da daha hissedilir bir alana (örneğin bina maliyeti) kaydırılır.
8. **Hikâye modu:** Beş görevlik öğreticinin ötesinde halk başına kısa bir senaryo dizisi olacak mı?
