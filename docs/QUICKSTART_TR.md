# İlk kez kullanacaklar için

Uygulama, LiDAR sensörünün çevresindeki nesnelere olan uzaklığını gösterir. Lazer veya yazılım bilgisi gerekmez. Sensörünüz yokken de bilgisayarda oluşturulan örnekle düğmeleri deneyebilirsiniz.

```bash
./start.sh --demo
```

Tarayıcıda `http://localhost:8080` açılır. Gerçek sensörle başlatmak için `./start.sh` kullanılır. Gerekirse [USB bağlantı yardımı](USB.md) bilgisayardaki ilk erişim iznini açıklar.

## Canlı görüntüde ne yapacağım?

1. **Nasıl denemek istersiniz?** bölümünde kendi USB sensörünüzü veya **Sensörsüz örnek** seçeneğini seçin. USB bağlantısı otomatik denenir.
2. **Hangi yöne baksın?** bölümünde ön, arka, geniş ön alan veya her yön seçin. İstediğiniz başka bir açı varsa **Farklı bir açı seç** bölümünü açın.
3. Ortadaki işaret sensördür. Noktalar, ölçülen nesnelere olan uzaklıkları gösterir. Merkeze yakın nokta, daha yakın nesne demektir. Renkli dilim, seçtiğiniz yöndür.
4. **Ölçümü okuyun** bölümünden en yakın nesnenin uzaklığına bakın. **Ölçümü durdur** görüntüyü güncel veri gibi tutmak yerine ölçümü durdurur; devam düğmesiyle yeniden başlayabilirsiniz.

Nokta görünmeyen bir yönün boş olduğu söylenemez. O yönden ölçüm alınamamış olabilir. Ön/arka açı seçimi, sensörün tüm çevresinden gelen ölçümlerin hangi bölümünün gösterileceğini belirler.

## Ölçülecek mesafeyi nasıl seçerim?

**Canlı görüntü → Ölçüm mesafesini değiştir** bölümünü açın.

- **En yakın mesafe:** Bundan daha yakın ölçümler değerlendirmeye alınmaz.
- **En uzak mesafe:** Bundan daha uzak ölçümler değerlendirmeye alınmaz. Değiştirince grafik de bu uzaklığa göre ayarlanır.
- Her sayının yanından **mm**, **cm** veya **metre** seçin. Örneğin **1 metre = 100 cm = 1000 mm**. Birimi değiştirmek, uzaklığın kendisini değiştirmez.
- **Yalnızca görüntüyü yakınlaştır** bölümünde grafiğin ölçeğini ayrıca değiştirebilirsiniz. Bu, inceleme aralığını değiştirmez.

Bu ayarlar sensörün fiziksel menzilini artırmaz veya lazerini seçtiğiniz mesafede durdurmaz; alınan ölçümlerin hangi bölümünün gösterilip değerlendirileceğini belirler.

## Sarı ve kırmızı uyarı ne zaman görünür?

**Nesne yaklaşınca ne zaman uyarı versin?** bölümünü açın. Örneğin:

- Sarı uyarıya **1 metre** yazın: nesne 1 metreye veya daha yakına geldiğinde dikkat uyarısı gösterilir.
- Kırmızı uyarıya **50 cm** yazın: nesne 50 cm'ye veya daha yakına geldiğinde kırmızı uyarı sarının yerine geçer.

Kırmızı mesafe sarıdan küçük olmalıdır. Grafiğin altındaki açıklamalar, sarı ve kırmızı kesikli çizgilerin seçtiğiniz mesafelerini gösterir. Uyarı çıktığında nesnenin uzaklığı ve hangi sınıra girdiği yazılır. Uyarılar yalnızca seçtiğiniz yön ve inceleme mesafesi içindeki ölçümlere göre verilir; bir makineyi durdurmaz.

Testin karşılaştırma uzaklığında ve hata payında da mm, cm veya metre seçebilirsiniz. Rapor, testin yapıldığı birimleri korur. Teknik JSON/CSV ölçümleri hesapların tutarlı olması için mm olarak saklanır.

## Bir testi nasıl yapacağım?

**Adım adım test** sayfasına girin. Testler soru şeklinde adlandırılmıştır; örneğin **Mesafeyi doğru ölçüyor mu?**

- Önce soruyu seçin.
- **Testi hazırlayın** bölümündeki üç yönergeyi uygulayın.
- Uzaklık isteniyorsa santimetre yazın: **100 cm = 1 metre**.
- Süreyi seçip **Testi başlat** düğmesine basın. Ölçüm boyunca nesneyi ve sensörü hareket ettirmeyin.
- Sonucu aşağıdaki açıklamadan okuyun. Örneğin cetvel 100 cm, sensör ortalaması 99,9 cm ise fark 0,1 cm olarak açıklanır.
- Paylaşmak veya okumak için **Sonuç raporunu indir** düğmesini kullanın. Rapor tarayıcıda açılır ve yazdırma menüsünden PDF yapılabilir.

Sensörsüz örnekte gerçek nesne koymanız gerekmez. Mesafe testinde **100 cm örnek hedefi hazırla** düğmesine basın ve uzaklığı 100 cm bırakın. Bu sonuç gerçek sensörün doğruluğunu kanıtlamaz.

İleri düzey kullanıcılar **Test ayarlarını ve notları değiştir**, **Hesapların ayrıntısını göster** ve **Ölçüm grafiğini incele** bölümlerini açabilir. Önceki sonuçlar **Önceki testler ve ayrıntılı veriler** bölümündedir.

## Kayıt ne içeriyor?

Kayıt bir video değildir. Bir süre boyunca alınan ölçüm noktalarını içerir:

- her noktanın sensöre göre yönü ve uzaklığı;
- ölçümlerin hangi sırayla ve ne zaman alındığı;
- gerçek sensör mü, sensörsüz örnek mi kullanıldığı;
- cihaz bilgileri ve seçtiğiniz görünüm ayarları.

Nesnelerin fotoğrafını, adını veya rengini kaydetmez.

## Kaydı nasıl oluşturup izleyeceğim?

1. **Kaydı başlat** düğmesine basın ve birkaç saniye bekleyin.
2. **Kaydı bitir** düğmesine basın.
3. **Kayıt ve izleme** sayfasına gidin.
4. **Kaydı burada izle** düğmesine basın. Dosya indirmeniz gerekmez; görüntü aynı sayfada açılır.
5. **Oynat**, ölçümlerin zaman içindeki değişimini gösterir. **Durdur**, görüntüyü o anda tutar. **Başa dön**, ilk ölçüme gider.
6. Zaman çubuğuyla istediğiniz ana geçin. İzleme hızını yavaşlatabilir veya hızlandırabilirsiniz.
7. **Bakılan yönü değiştir** ile aynı kayıt üzerinde ön/arka yön seçimini yeniden yapabilirsiniz.

Kaydı başka zaman izlemek için **Kaydı bilgisayara kaydet** düğmesine basın. Daha sonra **Kaydı aç** ile bu dosyayı seçin. Kaydın süresi, ölçüm sayısı ve kaynağı oynatıcının üzerinde görünür. Kayıtlar indirilmeden sayfa kapatılırsa bellekteki ölçümler kaybolur.

## İndirilen dosyalar arasındaki fark

| Dosya                    | İçinde ne var?                                    | Nasıl kullanılır?                                         |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| Sonuç raporu `.html`     | Testlerin okunabilir özeti ve açıklaması          | Tarayıcıda açın; paylaşın veya PDF yazdırın.              |
| Kayıt dosyası `.json`    | Bir süre boyunca alınan ölçümler                  | **Kaydı aç** ile yeniden izleyin.                         |
| Ölçüm tablosu `.csv`     | Tek bir anda, seçtiğiniz yöndeki noktalar         | Excel gibi bir programla inceleyin. Oynatılmaz.           |
| Tek ölçüm verisi `.json` | Bir ölçümün sayısal noktaları ve ayarları         | Yazılımla ayrıntılı inceleme içindir. Oynatıcıda açılmaz. |
| Test verileri `.json`    | Bir testin ayarları, hesapları ve ölçüm kanıtları | Teknik inceleme içindir. Oynatıcıda açılmaz.              |

**JSON**, bilgisayarların veriyi düzenli biçimde saklaması için kullanılan bir dosya biçimidir. Birkaç dosyanın uzantısının `.json` olması, aynı işi yaptıkları anlamına gelmez. Uygulama, yanlış dosyayı oynatıcıda açmaya çalıştığınızda hangi dosyayı seçmeniz gerektiğini açıklar.

## Teknik ayrıntıları nerede bulacağım?

- Canlı görüntüde **Gelişmiş görüntü ayarları**: mesafe filtresi, kalite filtresi, montaj yönü ve yakınlık sınırları.
- **Teknik ölçümler ve veri dosyaları**: tur hızı, nokta sayıları, ölçüm tablosu ve sayısal dışa aktarımlar.
- **Ayarlar ve yardım**: cihazın kimliği, desteklediği tarama modları, USB bağlantısı, sağlık sorgusu ve üretici kaynakları.

Bu geliştirmede gerçek sensör kullanılmadı. Sensörsüz örnek ve yazılım testleri, fiziksel sensör performansının doğrulandığı anlamına gelmez.
