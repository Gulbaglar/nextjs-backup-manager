# Next.js Backup Manager

**JSON dosya tabanlı Next.js App Router siteleri için tam/içerik/medya yedek modları, dosya bazlı SHA-256 doğrulama, otomatik geri alma noktalı güvenli geri yükleme ve fırsatçı otomatik yedekleme.**

🇬🇧 English: [README.md](README.md)

> Bir yedek, **doğrulanana** ve **geri yüklenebildiğine** kadar başarılı sayılmaz.

Bu, npm paketi değil; küçük, kendi içinde eksiksiz bir referans uygulaması. Fork'layın veya `src/lib/backup.ts` ve `src/app/admin` altındaki parçaları doğrudan kendi Next.js App Router projenize kopyalayın. Bir şeye bağlamadan önce gerçekten yedekleyip geri yükleyebileceğiniz bir şey olsun diye çalışan bir demo site ("ayarlar + görsel yükleme" küçük bir uygulama) olarak geliyor.

## Neden var

Bunun ilk sürümünü kendi portfolyo sitem ([gulbaglar.com](https://gulbaglar.com)) için yazdım — içeriğini bir veritabanı yerine JSON dosyasında tutuyor, bu kurulumla otomatik bir yedekleme hikâyesi hazır gelmiyor. Orada iyi çalışınca, "içerik JSON'da + yüklemeler diskte" şeklindeki aynı yapıya sahip herhangi bir Next.js sitesinde kullanılabilsin diye kendi deposuna çıkardım.

## Özellikler

- **Üç yedek modu.** `full` (içerik + admin hesabı + `public/uploads`), `content` (sadece JSON/hesap verisi — küçük, hızlı), `media` (sadece yüklemeler). Her yedekte ayrı seçilir.
- **Dosya bazlı bütünlük.** Her yedek, tüm arşivin hash'ine ek olarak bir `checksums.json` (içindeki her dosyanın SHA-256'sı) taşır. Geri yükleme ikisini de doğrular — aksi hâlde geçerli görünen bir arşivin içindeki tek bir bozuk dosya bile sessizce uygulanmaz, yakalanıp reddedilir.
- **Güvenli geri yükleme.** Doğrula → mevcut durumun otomatik **korumalı** bir güvenlik yedeğini al → arşivi bellekte aç ve sağlığını kontrol et → ancak o zaman gerçek dosyaları atomik rename ile değiştir. Son adımdan önceki herhangi bir hata canlı dosyalarınıza dokunmaz.
- **Moda duyarlı geri yükleme.** Sadece `content` yedeğini geri yüklemek `public/uploads`'a asla dokunmaz; sadece `media` yedeğini geri yüklemek JSON/hesap verinize asla dokunmaz. (Bunun ilk taslağı bunu tam tersine yapıyordu — aşağıdaki [Dersler](#bundan-çıkardığımız-dersler) bölümüne bakın.)
- **Koru + saklama süresi.** Herhangi bir yedeği **Korumalı** işaretleyerek otomatik temizlikten muaf tutun. En yeni 10'un dışındaki otomatik yedekler otomatik silinir; elle alınan ve korumalı yedekler asla silinmez.
- **Fırsatçı otomatik yedekleme.** Gerçek bir cron yok — her admin sayfası açılışında bir kontrol çalışır, son otomatik yedek 7 günden eskiyse (yapılandırılabilir, `src/lib/backup.ts`) yeni bir tane alır. Yedekleme sayfasından tamamen kapatılabilir.
- **Devam edebilen indirmeler.** Hem indirme uç noktası hem de demonun kendi yükleme-sunma rotası HTTP Range (`206 Partial Content`) destekler, böylece büyük bir yedek ya da görsel indirmesi baştan başlamak yerine kaldığı yerden devam edebilir.
- **Her arşive gömülü felaket kurtarma notları.** `.zip` içindeki `README-RESTORE.txt`, gerektiğinde bu admin paneli olmadan içeriği ve yüklemeleri elle nasıl geri yükleyeceğinizi anlatır.
- **Tek yönetici, JSON dosya deposu.** Kimlik doğrulama bcrypt ile hash'lenmiş şifre + HMAC imzalı oturum çerezi, dış servis yok.

## Hızlı başlangıç

```bash
git clone https://github.com/Gulbaglar/nextjs-backup-manager.git
cd nextjs-backup-manager
npm install
npm run dev
```

- `http://localhost:3000/admin/setup` — admin hesabınızı oluşturun (sadece ilk ziyarette).
- `http://localhost:3000/admin/settings` — demo sitenin adını/sloganını değiştirin.
- `http://localhost:3000/admin/media` — bir iki görsel yükleyin.
- `http://localhost:3000/admin/backup` — **Şimdi yedekle** (`full` deneyin), sonra ayarları tekrar değiştirin, sonra yedeği **geri yükleyin** ve geri döndüğünü izleyin.

## Kendi sitenize eklemek

1. `src/lib/backup.ts`, `src/lib/admin-store.ts`, `src/lib/auth.ts`, `src/app/admin/backup/[id]/route.ts` ve `src/app/admin/` altındaki Backup sayfası/eylemlerini projenize kopyalayın.
2. `src/lib/backup.ts`, `data/content.json`, `data/admin.json` ve `public/uploads/`'un tam olarak bu yollarda olmasını bekler — ya bu yapıya uyun ya da dosyanın en üstündeki sabitleri düzenleyin.
3. `.gitignore`'unuza `/data/` ve `/public/uploads/` ekleyin — yedekler (ve koruduğu içerik) asla commit edilmemeli.
4. Yüklemeleriniz çalışma zamanı bir route handler'dan sunuluyorsa (bu depodaki `src/app/uploads/[...path]/route.ts`'e bakın — `next start` build bittikten sonra `public/`'e eklenen dosyaları sunmaz), video veya büyük dosya sunuyorsanız orada da Range desteği olduğundan emin olun.

## Bundan çıkardığımız dersler

- **Moda duyarlı geri yükleme opsiyonel değil.** Mod ayrımının ilk sürümü, yüklemeleri eşitleme adımını yedeğin moduna göre kapılamıyordu — sadece `content` yedeğini geri yüklemek, `public/uploads`'taki her dosyayı o arşivin içindeki (boş) yükleme listesiyle eşleştirmek için SİLECEKTİ. Yayından önce, gerçekten bir `content` yedeği geri yüklenip `public/uploads`'ın öncesi/sonrası kıyaslanarak yakalandı. Bunu genişletiyorsanız, yeni bir yedek modu eklerken "bu neye DOKUNMUYOR" sorusunu da "bu neyi içeriyor" kadar ciddiye alın.
- **Yedeği değil, geri yüklemeyi test edin.** `createBackup()`'ın geçerli görünen bir zip ürettiğini doğrulayıp orada durmak kolay. Yukarıdaki hata ancak bir yedek gerçekten *geri yüklenip* sonuç, değişmemesi gerekenle kıyaslanınca ortaya çıktı.

## Lisans

MIT — bkz. [LICENSE](LICENSE).
