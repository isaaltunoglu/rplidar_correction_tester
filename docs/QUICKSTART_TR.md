# RPLIDAR Lab kullanım kılavuzu

Sensör takılı olmak zorunda değil. Bu klasörde terminal açıp:

```bash
./start.sh --demo
```

Arayüz tarayıcıda açılır. Otomatik açılmazsa terminaldeki `http://localhost:8080` adresine gidin. Uygulama tamamen yereldir; ağ veya bulut hesabı istemez.

## Profesöre gösterilebilecek akış

1. **Canlı tarama:** “Ön 120°” ile “Arka 120°” arasında geçiş yapın. Renkli sektör hangi açıların analiz edildiğini gösterir. Merkez ve açıklık sürgüleriyle özel açı seçin. 300° → 60° aralığı 0° üzerinden geçer.
2. **Yön ve filtreler:** “Filtreler & yön kalibrasyonu” bölümünden montaj ofseti, ters yön, mesafe ve kalite filtresini değiştirin. Görünüm yarıçapı yalnızca yakınlaştırmayı değiştirir; ölçüm filtresi değildir.
3. **Nokta inceleme:** Noktaya dokunun, fareyle üzerine gelin veya grafiğe odaklanıp ok tuşlarını kullanın. Ham açı, dönüştürülmüş açı, mesafe, X/Y ve Q değerlerini inceleyin.
4. **Cihaz & kaynaklar:** Simülasyon senaryosunu “Referans hedef · 1.000 mm” seçin. Canlı taramada ön sektöre dönün.
5. **Deney tezgâhı:** Mesafe doğruluğu seçin. Referans 1.000 mm, merkez 0°, açıklık 4°, süre 10 s ile örnek bir deney yapın. Sonuç açıkça **simülasyon** işaretlidir. Deney boyunca ayarlar sabitlenir.
6. **Karşılaştırma:** Farklı protokoller/koşullarla deneyleri tekrarlayın. Defterden JSON kanıtı, üstten HTML raporu indirin. HTML raporu tarayıcının yazdırma menüsünden PDF olarak kaydedilebilir.
7. **Kayıt & tekrar:** Kaydı başlatın, birkaç saniye sonra durdurup JSON indirin. Dosyayı yeniden açın, oynatma hızını ve konumunu değiştirin; canlı tarama sayfasında aynı ham veriyi farklı açılardan inceleyin.

## Gerçek cihazla sonraki kullanım

```bash
./start.sh
```

USB adaptörü bağlandığında aday seri portlar otomatik aranır. El sıkışması başarılı olunca cihazın gerçek modeli, seri numarası, firmware'i, sağlık bilgisi ve mod listesi görünür. Takılı cihaz yokken simülasyona kendiliğinden geçilmez; gerçek veri beklenir. Tarama kesilince eski veri güncelmiş gibi gösterilmez.

Başlangıçta seri port izni gerekiyorsa [USB.md](USB.md) yönergesini uygulayın. Uygulama `sudo` istemez ve izinleri kendisi değiştirmez. Olağandışı adaptörlerde Cihaz sekmesinden mevcut port seçilebilir.

**Duraklat** tarama ve motor durdurma komutlarını SDK'ya gönderir. **Devam et** edinimi yeniden başlatır. Sayısal hız ayarı yalnızca SDK destek ve geçerli RPM sınırlarını bildirdiğinde açılır. PWM tabanlı A2 cihazlarda doğrulanmış bir PWM sınırı varsayılmadığından varsayılan motor başlat/durdur kullanılır.

## Sonuçları yorumlama

- Ön 0°, sağ 90°, arka 180°, sol 270°; açılar saat yönünde artar. Fiziksel montajın ön yönünü ofsetle eşleştirin.
- Sektör seçimi yazılım filtresidir; sensör 360° dönmeye devam eder.
- Hiç dönüş alınmayan alana “güvenli” denmez. Yakınlık göstergesi bir robotu/makineyi kontrol etmez.
- σ tekrarlanabilirlik göstergesidir. Referans ölçümüne bağlı RMSE mutlak doğrulukla ilgili farklı bir ölçüttür.
- Tek tek noktalar yerine her turda dar hedef açıklığının medyanı örneklenir. Çok geniş açı farklı yüzeyleri karıştırabilir.
- Kayıt ve deney sonuçları tarayıcı belleğindedir; sayfayı kapatmadan indirin.
- Bu geliştirmede fiziksel sensör bağlı değildi. Gerçek cihaz, USB sıcak takma ve motor davranışı yeni donanım denemesiyle doğrulanmadı.
