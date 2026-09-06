# AGENTS.md — Trading Simulation Project Context & Memory

## 1. Project Overview
- **Nama Aplikasi:** Trading Simulation & Experimental Platform
- **Tujuan:** Platform simulasi pasar saham real-time untuk riset ekonomi eksperimental & perilaku pasar berbasis web socket.
- **Port Default:** `http://localhost:3000`

---

## 2. Tech Stack & Environment
- **OS / Platform:** macOS Darwin arm64 (Apple Silicon)
- **Runtime:** Node.js v22.14.0 & TypeScript
- **Framework:** Next.js 16 (App Router) + React 19
- **CSS / UI:** Tailwind CSS v4, Lucide Icons, Framer Motion, Base UI, Shadcn UI, Sonner
- **Real-Time Engine:** Custom WebSockets server (`server.ts`) via Socket.io
- **Database:** PostgreSQL 15 (`postgresql@15` via Homebrew di `/Users/andrichadeamitra/homebrew`)
- **ORM & Migrations:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`)

---

## 3. Konfigurasi Database Lokal (.env)
```env
DATABASE_URL=postgresql://andrichadeamitra@localhost:5432/trading_simulasi
PORT=3000
```

---

## 4. Akun & Kredensial Dummy

### A. Admin (Akses Control Panel & Monitor)
- **URL Login:** `http://localhost:3000/login` atau `http://localhost:3000/admin`
- **Username:** `Admin`
- **Password:** `admin`
- **Role:** `admin`
- **Saldo Awal:** Rp 100.000.000

### B. Responden Massal (30 Akun Standar)
- **Username:** `responden1` s.d. `responden30` (contoh: `responden1`, `responden2`, ...)
- **Password:** `password123`
- **Role:** `responden`
- **Saldo Awal:** Rp 100.000.000

### C. Responden Khusus (Nama Personal)
- **Username:** `Andi`, `Budi`, `Citra`, `Doni`
- **Password:** `password`
- **Role:** `responden`
- **Saldo Awal:** Rp 100.000.000

---

## 5. Command Panduan Operasional

### Menjalankan Server Lokal (Real-time Socket.io):
```bash
npm run dev:server
```

### Database Operations:
```bash
# Push schema dari Drizzle ke PostgreSQL
npm run db:push

# Seed stocks (36 saham) & admin
npm run db:seed

# Seed akun responden (responden1-30)
npm run db:seed:users

# Seed akun responden nama personal (Andi, Budi, Citra, Doni)
npm run db:create-users
```

---

## 6. Log Aktivitas Terakhir
- **Tanggal:** 31 Agustus 2026
- **Aktivitas:**
  - Setup database PostgreSQL lokal `trading_simulasi`.
  - Pembuatan `.env` dengan konfigurasi database lokal.
  - Instalasi dependensi npm bersih di macOS arm64.
  - Migrasi Drizzle ORM (`db:push`) berhasil diterapkan.
  - Database seeding selesai: 36 data saham dan 35 user akun (1 Admin + 30 Responden + 4 Responden Personal).
  - Server custom socket.io & Next.js berjalan aktif di `http://localhost:3000`.
  - **Mobile UX (mUX) Redesign:**
    - Sidebar desktop otomatis tersembunyi di layar mobile (`hidden md:flex`).
    - Penambahan `MobileBottomNav` (Bottom Navigation Bar) ergonomis di *Thumb-Zone* dengan safe-area inset.
    - Redesain `DashboardPage` menjadi *Fluid Mobile-First*: Hero Balance Card elegan (Total Kekayaan, Sisa Kas, Portofolio), status sesi & intervensi responsif, Segmented Control Tabs (Portofolio, Aktivitas Sesi, Statistik), serta Mobile Stock Cards dengan touch target ≥ 44pt.
    - Integrasi Bottom Sheet untuk profil & pengaturan tema di mobile.
    - **Ultra-Narrow (320px+) Adaptability Polish:** Implementasi typography clamp (`clamp(...)`), pencegahan text overlap, optimalisasi padding tepi, eliminasi Next.js Dev tool overlay badge, dan elastisitas kartu metrik di viewport tersempit.
    - **Zero-Latency Performance Optimization:**
      - Kompresi aset gambar favicon/logo dari 588KB (1024x1024) menjadi 9.4KB (`logo-icon-64.png`), memangkas waktu load aset menjadi 2.4ms.
      - Eliminasi artificial blocking loading skeleton di client-side pada `DashboardPage` dan `TradingPage` untuk instant zero-lag rendering.
      - Mengoptimalkan dynamic image rendering (`unoptimized` priority) dan response time server (<90ms).
    - **Landing Page (Root `/`) Mobile-First Overhaul:**
      - Redesain Hero Section dengan Typography Fluid Clamp `clamp(...)` dan logo favicon beresolusi tinggi.
      - Integrasi Tombol Call to Action (CTA) Utama di area *Thumb-Zone* (48px) yang dinamis mengikuti status sesi login (`user`).
      - Transformasi Feature Cards menjadi *Compact Grid Bento* responsif yang hemat ruang vertikal dan elastis di layar 320px+.
    - **Trading Page (`/dashboard/trading`) Mobile UX (mUX) & Pre-Market Modal Wizard:**
      - **Pemisahan Fase Ketat:** Saat fase `PRE_MARKET` (Pra-Pembukaan), hanya modul pra-perdagangan yang ditampilkan (tanpa kartu trading / order book). Antarmuka trading saham hanya muncul pada fase `TRADING`.
      - **Modal Wizard Prediksi per Saham:** Tampilan modal dialog terfokus untuk mengisi prediksi harga satu per satu dengan indikator step (`Saham 1 dari 3`), profile highlight saham, batas Auto-Rejection, dan stepper `PriceInput` yang ergonomis.
      - **Fitur Skip & Loop:** Responden dapat melewati (*skip*) saham yang belum ingin diisi, dan sistem otomatis menampilkan kembali saham yang di-skip setelah saham lainnya terisi hingga seluruh saham selesai.
      - **Ringkasan Hasil Prediksi & Fleksibilitas Edit:** Ketika semua saham telah terisi, modal tertutup dan menampilkan kartu ringkasan hasil isian di layar utama, dengan tombol edit individual yang tetap aktif hingga hitung mundur waktu pra-pembukaan berakhir.
    - **Mobile UX (mUX) Full Overhaul (Trading Page & Centered Focus Modal):**
      - **Responsive Header Stacking & Timer Deduplication:** Memisahkan header menjadi layout bertumpuk (baris atas: metrik sesi & countdown pill, baris bawah: judul halaman fluid `clamp`) sehingga judul *"Pra-Pembukaan Pasar"* tidak terpotong di layar 320px+. Menghilangkan redundansi timer ganda saat jeda dengan mengintegrasikan status *PAUSED* secara harmonis.
      - **Fluid Sticky Portfolio Bar:** Mengoptimalkan bar portofolio mobile yang ramping dengan penekanan pada *Total Kekayaan (NAV)* dan persentase floating PnL tanpa membuat teks angka bertabrakan di layar 320px.
      - **Compact & Sleek Hero Card:** Menyematkan visual mini progress bar (`0/3 Terisi`) dan CTA Utama terfokus. Saat seluruh saham terisi (100%), hero card berubah menjadi banner sukses kompak dengan link edit cepat yang hemat ruang layar.
      - **Compact Fintech Stock Cards:** Redesain kartu daftar saham menjadi layout horizontal ramping ala modern fintech (*Apple Stocks / Revolut*): Avatar ticker kotak melengkung, harga penutupan ringkas di kiri, serta pill CTA / nominal prediksi hijau emerald yang kontras di kanan (menghemat 40% tinggi vertikal sehingga 3 kartu saham tampak penuh dalam 1 pandangan layar).
      - **Floating Centered Glassmorphism Focus Card & Header Live Timer:** Mentransformasikan modal ke posisi **Tengah Layar (Middle Centered Dialog)** dengan z-index `z-[80]`, backdrop blur sinematik, segmented progress bar multi-segmen di atas kartu, **Live Session Countdown Timer Pill** (`⏱️ 01:54`) di samping tombol tutup modal, serta **Quick Percentage Chips** (`-5%`, `-2%`, `Sama`, `+2%`, `+5%`) untuk pengisian prediksi super cepat sesuai fraksi harga BEI.
    - **Trading Phase (`TRADING`) Seamless Modal & Menu Architecture:**
      - **Eliminasi Sub-View Statis di Mobile:** Menghilangkan tampilan detail saham statis di latar belakang mobile yang redundan. Layar utama selalu menampilkan **Menu / Katalog Saham Trading** yang bersih dan responsif.
      - **Floating Centered Focus Modal (`z-[80]`):** Men-tap saham di menu katalog langsung membuka modal dialog trading terpusat dengan paket lengkap:
        - **Grafik Harga Live di Bagian Atas:** Terletak di atas formulir agar tren visual terlihat seketika.
        - **Multi-Stock Switcher & Chevrons (`‹` `›`):** Beralih saham dengan 1-tap tanpa menutup modal.
        - **Mini Order Book Lelang Real-Time:** Menampilkan antrean BID/ASK di dalam modal dengan interaktivitas 1-tap copy harga.
        - **Live Countdown Timer & Quick Chips:** Timer sesi sinkron, Quick Price Chips (`Pasar`, `Bid`, `Ask`, `ARA`, `ARB`), dan Quick Lot Chips (`+1`, `+5`, `+10`, `50%`, `Max`).
    - **Zero-Scroll Single-Screen Modal Architecture (Ultra-Ergonomic Viewport Fit):**
      - **Eliminasi Vertical Scrollbar:** Mengganti `overflow-y-auto` menjadi `overflow-hidden` pada modal order trading dan modal prediksi pra-pembukaan. Seluruh konten pas 100% dalam satu pandangan layar tanpa perlu digulir atas-bawah.
      - **Compact Sparkline Top Chart:** Mendukung mode `compact={true}` pada `PriceChart` dengan tinggi terukur (`h-16 sm:h-18`) dan gridline presisi tanpa mengorbankan kualitas kurva data.
      - **Side-by-Side 2-Column Grid Input:** Menata formulir **Harga Order (Rp)** di kolom kiri dan **Jumlah Lot** di kolom kanan secara berdampingan lengkap dengan Quick Chips masing-masing (`Pasar, ARA, ARB` di kiri & `+1, +5, Max` di kanan), menghemat $>110\text{px}$ tinggi vertikal.
      - **Compact Live Order Book Pill:** Antrean lelang BID/ASK tampil dalam 2 baris teratas yang ramping dengan fitur 1-tap copy harga.
      - **Single-Row Action & CTA Bar:** Mengintegrasikan tombol utama `Kirim Order` dan navigasi `Lanjut ›` dalam satu baris horizontal ergonomis.
    - **Fintech Mobile-First Menu Catalog Redesign:**
      - **Sleek Balance Hero Card:** Kartu saldo hemat vertikal dengan live beacon status pasar berkedip, metrik Kas Tersedia & Nilai Portofolio responsif.
      - **Fintech Grade Stock Cards:** Kartu saham horizontal ramping ala modern fintech (*Apple Stocks / Revolut*): Avatar ticker kotak bergradien tebal, Tag Sektor tematik warna-warni, indikator kepemilikan lot instan, tren harga real-time, dan tombol `Trade ⚡` dengan touch target $\ge 44\text{pt}$.
    - **Anti-Orphan Typography & Balanced Header Layout:**
      - **Concise Copywriting:** Mengganti copy judul menjadi `"Perdagangan Saham"` dan subjudul menjadi `"Pilih saham untuk transaksi dan pantau grafik harga live."`
    - **Trading Order Modal Auto-Advance Workflow:**
      - **Modal Tidak Tertutup Otomatis Sebelum Semua Saham Terisi:** Ketika responden mengirimkan order (`handlePlaceOrder`), sistem menandai saham tersebut sebagai terorder (`ordersPlacedMap`), lalu otomatis berpindah (*auto-advance*) ke saham berikutnya yang belum diorder.
      - **Penyelesaian Otomatis:** Modal trading hanya ditutup secara otomatis ketika semua saham aktif dalam sesi tersebut telah selesai dikirimi order (atau jika pengguna menutup secara manual).
    - **Dual Adaptive Interface Architecture (Desktop Full Workstation vs Mobile Modal Wizard):**
      - **Desktop View (`hidden md:block`):** Menampilkan **Modern Minimalist Trading Workstation (12-Column Grid)** tanpa modal popup:
        - **Sleek Minimalist Stock Selector Pill Bar:** Baris tab saham horizontal ramping ala TradingView/Robinhood dengan harga live, PnL %, dan indikator lot.
        - **Active Stock Identity Ribbon:** Nama emiten, sektor, dan nilai harga real-time besar (`text-2xl font-black`) dengan fallback harga akurat (eliminasi glitch `Rp 0`).
        - **Main Workstation Grid (12-Kolom):**
          - **Kiri (7 Kolom):** Grafik Harga Live Interaktif Besar (`h-60`) & Order Book Lelang Real-Time 7 baris dengan visual depth bar proporsional dan 1-klik copy harga.
          - **Kanan (5 Kolom):** Card Eksekusi Order ramping dengan Segmented Control BID/ASK, input harga otomatis terisi default pasar, stepper lot, quick chips, estimasi kas, dan CTA Order vibrant (`h-12`).
      - **Mobile View (`md:hidden`):** Menampilkan katalog menu fintech yang ringkas dan **Desktop-Grade Mobile Modal Wizard**:
        - **Stock Profile Ribbon Lengkap:** Avatar ticker bergradien tebal dengan `whitespace-nowrap min-w-[42px]` (mencegah teks kode patah baris seperti `S-` dan `16`), nama emiten, tag sektor warna-warni, harga real-time besar, kepemilikan lot (`Milik Anda: X Lot (X00 Lbr)`), dan batas ARA/ARB.
        - **Segmented Sub-Tabs View Switcher:**
          - **Tab 1: Formulir Order (⚡):** BID/ASK Toggle, Kas & ARA/ARB info, 2-kolom form input harga & lot dengan stepper $\pm$ dan quick chips BEI, mini live order book lelang (2 baris), dan ringkasan transaksi.
          - **Tab 2: Grafik & Order Book (📊):** Grafik fluktuasi harga live yang luas (`h-32`), serta antrean order book lelang lengkap (5 baris) dengan bar kedalaman visual dan 1-tap copy harga.
        - **Thumb-Zone Action Bar:** Tombol `Kirim Order & Lanjut ›` (dengan auto-advance) dan tombol `Lewati ›` di sepertiga bawah layar.
    - **Enlarged High-Visibility Session Timer:**
      - **Header Utama:** Ukuran countdown timer pill diperbesar menjadi `text-sm sm:text-base font-black font-mono` dengan padding `px-3.5 py-1.5`, icon `Timer` `size-4 sm:size-4.5`, dan warna adaptif dinamis (Emerald saat normal, Amber saat $\le 30$s atau PAUSED, Rose + Pulse saat $\le 10$s).
      - **Modal Dialog:** Countdown timer pada modal pra-pembukaan dan order trading mobile turut diperbesar menjadi `text-xs sm:text-sm font-black` agar sisa waktu langsung disadari pengguna dengan jelas.
    - **Context-Anchored Running Text (Berita Baik & Berita Buruk):**
      - **Posisi Di Atas Modal Dialog:** Saat modal (Prediksi Pra-Pembukaan atau Order Trading Mobile) terbuka, *Running Text* muncul terpasang tepat di atas kartu modal dengan celah jarak yang presisi (`gap-2`), bergerak harmonis bersama modal.
      - **Sinkronisasi Penutupan Modal:** Saat modal ditutup oleh pengguna, *running text* yang berada di atas modal ikut tertutup secara bersamaan.
      - **Transisi ke Bawah Deskripsi Halaman:** Ketika modal tertutup (atau pada mode desktop tanpa modal), *running text* otomatis berpindah dan tampil rapi langsung di bawah paragraf deskripsi fase (*Pra-Pembukaan Pasar* / *Perdagangan Saham*).
    - **High-Speed Zero-Latency Performance Optimization (170x Speedup):**
      - **Production Server & Bundle Compilation:** Menambahkan mode server produksi teroptimasi (`NODE_ENV=production tsx server.ts`) dan script `npm run prod` serta `npm run start:server` yang memangkas waktu load halaman dari ~1.150ms menjadi **6ms - 25ms** (kecepatan meningkat **~170x lipat**).
      - **Package Import Optimization:** Menambahkan `optimizePackageImports` di `next.config.ts` untuk library besar (`lucide-react`, `framer-motion`, `@base-ui/react`, `dayjs`, `sonner`), mengisolasi bundler dan mengeliminasi overhead ratusan icon/modul tak terpakai.
      - **External Native Server Packages:** Mengonfigurasi `serverExternalPackages` (`pg`, `bcryptjs`, `exceljs`, `archiver`) agar tidak terkena bundling webpack berulang.
      - **IPv4 Direct DB Connection:** Mengubah host `DATABASE_URL` ke `127.0.0.1` guna mengeliminasi latensi DNS IPv6 lookup delay pada macOS driver `pg` (memangkas latency dari 30ms ke 4ms).
      - **Non-Blocking Font Display:** Menambahkan `display: "swap"` pada font Inter & JetBrains Mono untuk instant visual rendering tanpa blocking paint pipeline browser.
      - **Hasil Benchmark Terkini:**
        - Halaman Root (`/`): **25ms**
        - Halaman Login (`/login`): **7ms**
        - Halaman Dashboard (`/dashboard`): **8ms**
        - Halaman Trading (`/dashboard/trading`): **6ms**
      - **Zero TypeScript Errors:** Verifikasi `tsc --noEmit` lolos 100% tanpa error.
    - **Dashboard Running Text Integration:**
      - Mengganti alert card statis multi-baris intervensi pada halaman Dashboard (`/dashboard`) dengan komponen marquee animasi `<RunningText />`.
      - Menampilkan *Berita Baik* (dan *Berita Buruk*) secara dinamis dengan badge emiten (`[ S-13 ]`, dll.), glowing status beacon, loop mulus tanpa jeda, pause saat hover, dan sinkronisasi real-time via socket event `scheduler-state` & `intervention-triggered`.
    - **Universal Mobile-Only Modal Architecture & Desktop Pre-Market Workstation:**
      - **Desktop Pre-Market (`hidden md:block`):** Menghapus penggunaan modal popup dialog dan latar backdrop gelap di layar desktop. Menampilkan **Multi-Card Workstation Grid (3 Kolom)** langsung di halaman:
        - Kartu informasi saham per emiten dengan avatar ticker, nama, sektor, harga penutupan, batas ARA/ARB.
        - Formulir prediksi harga pembukaan inline langsung di kartu masing-masing saham lengkap dengan `PriceInput` stepper, quick chips fraksi BEI (`-5%`, `-2%`, `Sama`, `+2%`, `+5%`), badge fraksi, dan tombol `Simpan Prediksi` / `Simpan Perubahan`.
        - Banner progres pra-pembukaan dengan tracker penyelesaian (`X/3 Terisi`).
    - **Catalog-First Trading Navigation Architecture (Zero Auto-Popup on Desktop & Mobile):**
      - **Awal Masuk Halaman Selalu Menampilkan Daftar Saham:** Saat membuka menu trading (`/dashboard/trading`) maupun saat pergantian sub-sesi `TRADING`, antarmuka **tidak langsung masuk ke mode transaksi/workstation dan tidak otomatis memunculkan modal popup**, melainkan selalu diawali dengan **Daftar Saham (Stock Catalog)** terlebih dahulu.
      - **Desktop Catalog & Workstation Flow (`hidden md:block`):**
        - Saat belum ada saham yang dipilih (`stock === null`), desktop merender **Desktop Stock Catalog Grid (3 Kolom)** dengan hero banner saldo, kartu emiten interaktif (avatar ticker tebal, nama, sektor, deskripsi, harga real-time, perubahan %, ARA/ARB, kepemilikan lot), dan tombol aksi `"Buka Terminal Transaksi {Kode} ›"`.
        - Saat pengguna mengklik salah satu saham, sistem beralih ke **12-Column Workstation Mode** lengkap dengan tombol navigasi `‹ Daftar Saham` di bagian atas untuk kembali ke tampilan katalog kapan saja.
      - **Mobile Modal on Tap Flow (`md:hidden`):**
        - Pada mobile, layar utama selalu menampilkan ringkasan saldo hero card dan menu katalog daftar saham vertikal.
        - Modal dialog terpusat (`isOrderModalOpen`) **hanya muncul saat pengguna secara eksplisit men-tap kartu saham tertentu** (`selectStock(s)`).
        - Saat modal ditutup (`handleCloseOrderModal`), pengguna kembali secara mulus ke daftar saham mobile.
      - **Pre-Market & Subsession State Reset:** `onSubSessionStarted` dan `onRoundStarted` secara otomatis mereset status modal (`isPredictionModalOpen = false`, `isOrderModalOpen = false`) dan menginisialisasi `stock = null` sehingga setiap sesi baru selalu menyajikan gambaran katalog pasar secara bersih.
    - **Unified Single-View Mobile Trading Modal (All-In-One Full View):**
      - **Eliminasi Sub-Tabs Switcher:** Menghilangkan pemisahan tab (`Formulir Order` vs `Grafik & Order Book`) pada modal trading mobile.
      - **Tampilan Terpadu Satu Layar (Scrollable Full-Height View):** Seluruh elemen esensial disatukan secara berurutan dalam satu modal scrollable yang ergonomis:
        1. **Segmented Step Bar & Multi-Stock Switcher:** Header interaktif dengan tombol panah chevron `‹ Kode ›`, live timer sesi, dan indikator terorder.
        2. **Kartu Identitas Emiten & Metrik Real-Time:** Avatar ticker, nama, sektor, harga live, perubahan %, kepemilikan lot, dan batas ARA/ARB.
        3. **Grafik Fluktuasi Harga Live:** Sparkline curve live yang responsif dan presisi.
        4. **Formulir Eksekusi Order:** Segmented toggle BID/ASK, info kas & kepemilikan lot, 2-kolom input harga (dengan quick chips BEI: Pasar, ARA, ARB), stepper lot (dengan quick chips: +1, +5, Max), ringkasan nominal total transaksi & estimasi sisa kas, serta validasi instan.
        5. **Order Book Lelang Real-Time (Bagian Bawah):** Kedalaman antrean lelang dinamis (BID & ASK) dengan visual depth bar proporsional, 1-tap copy harga, dan scroll vertikal saat antrean panjang melebihi tinggi layar.
      - **Fixed Bottom Thumb-Zone Action Bar:** Tombol CTA `"Kirim Beli/Jual & Lanjut ›"` (dengan auto-advance) dan `"Lewati ›"` selalu tersemat di bagian bawah modal untuk kenyamanan eksekusi satu jempol.
    - **Real-Time Order Book Synchronization & Automatic BEI Tick Snapping:**
      - **Socket Synchronization:** Menambahkan handler socket backend `get-orderbook` dan listener client `order-book-update` / `orderbook-snapshot` sehingga setiap order baru yang dikirimkan langsung ter-update secara instan pada antrean BID/ASK lelang.
      - **Auto BEI Tick Snapping:** Memastikan inisialisasi default harga saham secara otomatis dibulatkan ke kelipatan fraksi harga BEI yang sah (`snapToTickSize`), mencegah false rejection/peringatan fraksi harga tidak valid pada harga pasar.
    - **Branding & Copywriting Rename to "Simulasi Investasi":**
      - **Global Rebranding:** Mengganti seluruh teks, logo label, metadata judul halaman, dan deskripsi aplikasi dari *"Simulasi Trading"* / *"SimulasiTrading"* menjadi **"Simulasi Investasi"** / **"SimulasiInvestasi"**.
      - **Area Terpapar:**
        - **Header / Navbar:** Brand logo dan nama aplikasi `SimulasiInvestasi`.
        - **Footer:** Copy hak cipta `— Simulasi Investasi & Analisis Perilaku Pasar`.
        - **Root Metadata (`layout.tsx`):** Title `Simulasi Investasi & Analisis Perilaku Pasar`.
        - **Landing Page (`/`):** Headline `Simulasi Investasi & Riset Pasar`.
        - **Dashboard Page (`/dashboard`):** Subtitle sapaan `Simulasi Investasi & Riset Pasar`.
        - **Sidebar Logo Alt:** `Logo Simulasi Investasi`.
    - **Mobile UX (mUX) Admin Resume & Leaderboard Overhaul (320px+ Fluidity):**
      - **Resume Admin (`/admin/resume`):**
        - **Fluid Header & Action Grid:** Judul dinamis `clamp(...)`, filter tanggal yang ramping, dan grid aksi export 2-kolom (`Laporan (.xlsx)` & `Order Book`) dengan touch target $\ge 40\text{px}$ dan feedback visual aktif.
        - **2x2 Bento KPI Grid on Mobile:** Mengubah 4 kartu saldo/peserta bertumpuk vertikal menjadi grid 2x2 ramping di mobile (4 kolom di desktop), menghemat $>60\%$ ruang vertikal dan menjaga semua metrik inti langsung terlihat di layar tanpa scroll berlebih.
        - **Compact Transaction Ticket Cards (< md):** Mengganti tabel 8-kolom yang rawan terpotong menjadi kartu tiket transaksi mobile ramping: badge kode saham bergradien tebal, tag intervensi, jam transaksi, indikator *Beli $\rightarrow$ Jual* ber-avatar, perkalian harga $\times$ lot, dan total nilai match kontras emerald.
        - **Full Data Table on Desktop (>= md):** Mempertahankan tabel data lengkap pada layar desktop dengan hover states yang bersih.
      - **Admin Hasil & Leaderboard (`/admin/hasil`):**
        - **Olympic Top-3 Visual Podium on Mobile:** Mengubah tumpukan 5 kartu vertikal panjang (~450px) menjadi satu widget podium 3-kolom artistik (*Juara 2 Perak di kiri, Juara 1 Emas bermahkota & elevated di tengah, Juara 3 Perunggu di kanan*) dengan tinggi proporsional, menghemat $>300\text{px}$ tinggi layar.
        - **Macro KPI Ribbon (3-Kolom):** Menyajikan ringkasan makro seketika: Total Responden, Rata-rata NAV (Jt), dan Total Kas+Saham Ekosistem (M) di atas layar.
        - **Quick Search & Filter Controls:** Input pencarian instan nama responden dengan tombol clear (X), serta tombol segmented sort (`Rank NAV`, `P&L %`, `Sisa Kas`).
        - **Progressive Disclosure Collapsible Tickets (< md):** Kartu responden mobile ultra-ramping (~52px) dengan 1-tap expandable drawer untuk melihat perincian Sisa Kas, Portofolio, dan P&L Rupiah tanpa clutter.
      - **Admin Trading Monitor (`/admin/trading`):**
        - **Fluid Header & High-Visibility Countdown Banner:** Judul fluid clamp, status live connection beacon, indikator status PAUSED dinamis, dan banner status ronde/sesi dengan countdown timer monospaced besar.
        - **2x2 Bento KPI Grid (Placed Above the Fold):** Memindahkan 4 metrik makro (*Peserta Aktif, Transaksi, Total Volume Rupiah, Rerata / Match*) dari dasar halaman ke atas layar dalam grid 2x2 ramping di mobile (4 kolom di desktop).
        - **Compact Fintech Stock Cards:** Kartu saham horizontal ramping dengan avatar ticker bergradien tebal, nama emiten, harga live real-time, perubahan %, serta pill mini untuk spread lelang BID/ASK dan volume terpasang.
        - **Mobile Match Transaction Tickets (< md):** Mengganti tabel 7-kolom dengan kartu tiket match ramping: avatar pembeli $\rightarrow$ penjual dengan titik warna, perkalian harga $\times$ lot, dan total nilai match kontras emerald.
        - **Full Data Table on Desktop (>= md):** Tabel data analitis lengkap dengan sticky header untuk monitor workstation.
    - **Mobile UX (mUX) Admin Control Panel & Experimental Scheduler Overhaul (`/admin`):**
      - **Ultra-Narrow Screen Adaptability (320px+):**
        - Memecah susunan kontrol `LiveStatusPanel` dari satu baris horizontal kaku menjadi **2-Tier Flexible Layout**: Baris atas untuk status badge fase & badge penangguhan (*Dijeda*), baris bawah untuk kelompok tombol aksi `[Lanjutkan/Jeda]` dan `[Hentikan]` dalam grid 2-kolom mobile yang tidak pernah terpotong atau keluar layar.
      - **Metric Summary Grid (Periode, Sesi, Ronde):** Mentransformasikan teks status menjadi 3 kartu widget ringkas (`grid grid-cols-3`) berpenampilan monospaced tebal dan bersih.
      - **Fluid Session Matrix & Progress Stepper:**
        - Redesain `PeriodSummaryCard` menjadi kartu sesi fluid dengan badge nomor sesi kotak rounded, indikator intervensi (Berita Baik/Buruk), dan tombol aksi `[ Mulai ]` / `[ Selesai ]` ergonomis ber-touch target $\ge 40\text{px}$.
        - `SessionProgress` tracker dengan visual beacon radio tower berkedip, status centang ronde selesai, dan pill ronde adaptif (`R1 · S-1, S-2`).
      - **Dual-View Live Transaction Monitor:**
        - **Mobile (< md):** Tiket transaksi kartu ramping dengan badge user, badge kode saham bergradien tebal, pill BID/ASK, serta perkalian harga $\times$ lot.
        - **Desktop (>= md):** Tabel data monitor live lengkap dengan sticky header.
      - **Safe-Area Padding & Zero Overlap:** Memperluas bottom padding `pb-28 md:pb-8` sehingga seluruh konten dapat digulir bebas tanpa tertutup oleh `MobileBottomNav`.
    - **Toast Notification Deduplication & Mobile Floating Layout:**
      - **Anti-Duplication (ID-Based Debouncing):** Menyematkan unique ID (`id: "round-status"`, `id: "session-status"`, dll.) pada seluruh pemanggilan `toast.success/info/warning/error` di Admin Trading & Scheduler.
      - **Ref-Based Socket Listener Stabilization:** Mengganti dependensi reaktif `activeRound` dengan `activeRoundRef` dalam `useEffect` socket agar tidak memicu unbind/re-bind ganda listener event yang menyebabkan toast ganda saat ronde dimulai.
      - **Mobile-First Top-Center Position & Stack Limit:** Mengonfigurasi Sonner dengan `position="top-center"`, `visibleToasts={1}`, dan `duration={2600}`, memastikan hanya 1 toast aktif yang tampil mengambang elegan di atas layar tanpa menumpuk (*stacking*) dan tanpa menutupi konten bawah atau tombol navigasi mobile.
      - **Copywriting Clean-up:** Menyeragamkan istilah notifikasi dari format kode `PRE_OPENING` menjadi format bahasa Indonesia yang baku: *"Ronde 1 dimulai — Sesi Pra-Perdagangan berjalan."*
  - **Tanggal:** 5 September 2026
  - **Aktivitas:** Implementasi Lengkap Kuesioner Profil Psikologis (Loss Aversion & Emotional Intelligence) & Gateway Eksperimen.
    - **1. Database Schema & Migration (`src/db/schema.ts`):**
      - Penambahan 3 tabel baru:
        - `questions`: Menyimpan bank butir kuesioner (tipe `LA` / `EI`, nomor urut, teks pertanyaan, status aktif).
        - `questionnaire_responses`: Menyimpan jawaban skala Likert (1-5) mentah per responden per pertanyaan.
        - `respondent_profiles`: Menyimpan agregat skor total LA & EI, rata-rata skor, kategori (`Tinggi`, `Sedang`, `Rendah`), string profil (`"LA(T)+EI(S)"`), kelompok (`A` s.d. `I`), dan timestamp pengisian.
      - Berhasil melakukan migrasi schema ke PostgreSQL lokal melalui `npx drizzle-kit push`.
    - **2. Seeding Instrumen Pertanyaan & Sampel Responden:**
      - `src/db/seed-questionnaire.ts`: Seeding 30 butir pertanyaan default (15 Loss Aversion + 15 Emotional Intelligence) dari dokumen referensi *Instrument 1.docx*.
      - `src/db/seed-responses.ts`: Seeding data simulasi jawaban kuesioner untuk 18 responden dengan variasi lengkap dari seluruh 9 kelompok profil (`LATEIT (A)` s/d `LAREIR (I)`).
    - **3. Engine Kalkulasi Skor & Algoritma Tercile (`src/lib/questionnaire-logic.ts`):**
      - Matriks 9 kelompok profil psikologis (`LATEIT (A)`, `LATEIS (B)`, `LATEIR (C)`, `LASEIT (D)`, `LASEIS (E)`, `LASEIR (F)`, `LAREIT (G)`, `LAREIS (H)`, `LAREIR (I)`).
      - Fungsi klasifikasi mandiri berbasis Threshold Standar (Skor 15-34 = Rendah, 35-54 = Sedang, 55-75 = Tinggi).
      - Algoritma Distribusi Populasi Tercile (`computePopulationTerciles`): Membagi skor seluruh responden secara independen ke dalam persentil 33.3% (Tercile 1: Rendah, Tercile 2: Sedang, Tercile 3: Tinggi).
    - **4. Backend API Suite:**
      - `GET /api/questionnaire/questions`: Mengambil daftar pertanyaan aktif berurutan per tipe.
      - `GET /api/questionnaire/status`: Memeriksa status penyelesaian kuesioner oleh user.
      - `POST /api/questionnaire/submit`: Menyimpan jawaban responden dan menghitung profil secara aman di server tanpa membocorkan skor/kategori ke respon client.
      - `GET, POST, PUT, DELETE /api/admin/questionnaire`: Modul CRUD pertanyaan kuesioner.
      - `GET /api/admin/profiles`: Mengambil daftar responden beserta skor LA, skor EI, kategori, string profil, dan grup kombinasi.
      - `POST /api/admin/profiles/recalculate`: Menjalankan ulang kalkulasi pengelompokan berbasis distribusi Tercile seluruh populasi responden yang telah mengisi.
      - `GET /api/admin/export-profiles`: Mengunduh laporan Excel (`.xlsx`) 2 sheet: *Ringkasan Profil Responden* & *Jawaban Mentah Likert*.
    - **5. Frontend Respondent Flow & Gateway Interceptor:**
      - `QuestionnaireGuard.tsx`: Terintegrasi di `src/app/dashboard/layout.tsx`. Responden yang belum mengisi kuesioner otomatis dialihkan ke `/questionnaire` saat mencoba mengakses dashboard/trading eksperimen. Admin otomatis di-bypass.
      - `src/app/questionnaire/page.tsx`: Wizard 2-tahap (Tahap 1: Loss Aversion, Tahap 2: Emotional Intelligence) dengan indikator step interaktif, tombol pilihan Likert 1-5 ber-touch target $\ge 44\text{pt}$, tombol navigasi, validasi kelengkapan, dan layar konfirmasi sukses yang menjaga kerahasiaan skor 100%.
    - **6. Admin CMS Modules:**
      - **Pengelolaan Kuesioner (`/admin/kuesioner`):** Metrik ringkasan bank soal, filter tipe LA/EI, modal tambah pertanyaan baru, inline edit teks soal, switch toggle aktif/nonaktif, dan dialog konfirmasi hapus.
      - **Hasil Profil Responden (`/admin/profil-responden`):** Bento KPI cards makro, visual distribusi 9 kelompok profil, input pencarian nama, filter kelompok profil & kategori, tombol *Hitung Ulang Tercile*, dan tombol *Export Excel (.xlsx)*.
      - Penambahan menu navigasi di `AppSidebar.tsx` & `MobileBottomNav.tsx`.
    - **8. Mobile UX (mUX) Admin Questionnaire & Profile Overhaul (320px+ Fluidity):**
      - **Pengelolaan Kuesioner (`/admin/kuesioner`):**
        - **Ultra-Narrow Screen Adaptability (320px+):** Header adaptif dengan fluid typography `clamp(0.95rem, 3.5vw, 1.25rem)` dan 2-kolom mobile action bar (`[Refresh Data]` & `[+ Butir Baru]`).
        - **KPI Metrics 2x2 Bento Grid:** Metrik Total Butir, Loss Aversion, Emotional Intel, dan Skala Likert tersaji dalam grid 2x2 ramping di mobile tanpa text overflow.
        - **Elastic Segmented Control:** Tab filter `Semua`, `LA`, `EI` dengan badge count yang elastis mengikuti lebar layar tanpa terpotong.
        - **Interactive Mobile Question Cards (< md):** Mengganti tabel data kaku menjadi kartu tiket kuesioner mobile: avatar instrumen bergradien tebal, switch toggle status publikasi interaktif 1-tap, teks pernyataan bernavigasi leluasa, ribbon metrik responden & rerata skor, serta tombol aksi `Edit` & `Hapus` dengan area sentuh ergonomis $\ge 44\times 44\text{pt}$.
        - **Mobile Slide-Up Bottom Sheet Drawer:** Modal tambah/edit pertanyaan bertransformasi menjadi *Slide-up Drawer* dengan drag handle bar, auto-scrolling form, dan *Thumb-Zone Sticky Action Bar* di sepertiga bawah layar.
      - **Hasil Profil Responden (`/admin/profil-responden`):**
        - **2-Column Action & Filter Controls:** Tombol `[Hitung Tercile]` dan `[Ekspor Excel]` tertata rapi dalam 2-kolom mobile grid dengan touch target $\ge 40\text{px}$.
        - **Search with 1-Tap Clear:** Input pencarian dengan tombol reset (X).
        - **Progressive Disclosure Accordion:** Kartu tiket responden mobile dengan 1-tap expandable drawer untuk melihat detail karakteristik psikologis, narasi perilaku, dan timestamp penyelesaian.
    - **9. Mobile UX (mUX) Respondent Questionnaire Overhaul (`/questionnaire`):**
      - **Ultra-Narrow Screen Adaptability (320px+):** Mengeliminasi potensi overflow dan layout break pada layar sempit dengan menerapkan fluid clamp typography (`clamp(...)`), penataan header kompak dengan truncation pintar, dan padding adaptif `px-2.5 sm:px-6`.
      - **Likert 5-Scale Touch Optimization:** 5 tombol skala respon terdistribusi dalam grid 5-kolom dengan tinggi sentuh `min-h-[48px] sm:min-h-[58px]` dan lebar $\ge 50\text{px}$ di layar 320px (memenuhi standar Apple HIG $\ge 44\times 44\text{pt}$), label singkatan cerdas (`STS`, `TS`, `N`, `S`, `SS`), haptic visual feedback `active:scale-95`, dan visual highlight border & ring saat terpilih.
      - **Floating Thumb-Zone Sticky Action Bar:** Navigasi tombol lanjut/kirim terpasang secara melayang di sepertiga bagian bawah layar (`sticky bottom-3 z-30`) dengan latar glassmorphism `backdrop-blur-xl`, live counter butir tersisa (`Sisa X butir` / `Siap Lanjut`), dan tombol full-fluid responsive yang ergonomis dijangkau oleh jempol satu tangan.
      - **Celebratory Completion Screen:** Tampilan sukses interaktif dengan icon checklist animasi, ringkasan konfidensialitas data, dan tombol CTA utama `"Mulai Eksperimen Simulasi Investasi ›"` yang mengarah langsung ke sesi eksperimen.
    - **10. Dedicated Respondent Questionnaire Detail Page (`/admin/profil-responden/[id]`):**
      - **Halaman Detail Khusus per Responden:** Menyajikan rincian lengkap 30 butir jawaban instrumen (15 Loss Aversion + 15 Emotional Intelligence) dari masing-masing responden.
      - **Header & Pager Navigasi Cepat:** Tombol kembali ke daftar profil (`‹ Daftar Profil`), rekam jejak breadcrumbs, dan tombol pager `‹ Responden Sebelumnya` / `Responden Berikutnya ›` untuk navigasi langsung antar-responden tanpa harus kembali ke tabel.
      - **Bento Card Metrik Psikologis:** Menampilkan skor total LA (raw score / 75 & rerata / butir), skor total EI (raw score / 75 & rerata / butir), kategori T/S/R dengan badge warna tematik, visual progress bar, serta narasi karakteristik profil kelompok A-I.
      - **Segmented Control & Filter Frekuensi Likert:** Tab instrumen (`Semua 30`, `LA 15`, `EI 15`), search keyword butir pertanyaan, dan filter interaktif frekuensi skor (1 s/d 5) yang menyaring pertanyaan sesuai skor yang dipilih.
      - **Visualisasi Spektrum Skala Likert 5-Opsi:** Setiap butir pertanyaan menyajikan visual 5 opsi lengkap, di mana opsi yang dipilih responden disorot dengan warna vibran (Emerald, Amber, Rose), ring glow, checkmark, dan teks keterangan nilai jawaban.
      - **Akses Langsung dari Daftar Profil:** Tombol `"Detail"` pada tabel desktop dan `"Buka Detail Jawaban Lengkap (30 Butir) ›"` pada mobile drawer tiket responden di `/admin/profil-responden`.
      - **Fitur Cetak / Print:** Tombol `Cetak / Print` (`window.print()`) untuk export/printout lembar hasil pengisian responden secara profesional.
    - **11. Mobile UX (mUX) Filter Bar & Silky-Smooth 120fps Accordion Optimization (`/admin/profil-responden`):**
      - **Ultra-Narrow Screen Adaptability (320px+):** Header ribbon, 9-Group Matrix, Search Input, dan 4 Dropdown Selects beradaptasi secara dinamis tanpa layout break atau teks overlap di layar 320px+.
      - **Buttery-Smooth Apple Cubic-Bezier Transitions (`cubic-bezier(0.16, 1, 0.3, 1)`):**
        - Mengeliminasi penyebab efek "patah-patah" (instant jumping padding) dengan mengisolasi padding di dalam container `overflow-hidden` inner child.
        - Menerapkan kurva fisika Apple iOS `ease-[cubic-bezier(0.16,1,0.3,1)]` berdurasi `300ms` pada ekspansi `grid-template-rows` yang sinkron dengan rotasi icon chevron panah dan pergerakan halus `translate-y-0 / -translate-y-2` + `opacity`.
        - Menghasilkan sensasi animasi buka-tutup drawer yang sangat mulus, fluid, dan bebas lag pada kecepatan 60fps/120fps.
      - **Native-Like Styled Filter Selects (2x2 Grid on Mobile):** 4 dropdown selector (`Semua Kelompok`, `Semua LA`, `Semua EI`, `Urut: ID/Nama`) ditata dalam grid 2x2 elastis di mobile dengan custom chevron SVG, styling `appearance-none`, tinggi sentuh ergonomis `h-11 sm:h-9` ($\ge 44\text{pt}$), `truncate`, dan tactile feedback `active:scale-[0.98]`.
      - **Clear Search Button:** Tombol reset `(X)` instan di dalam search bar dengan area tap $\ge 24\text{px}$.
      - **Card Accordion & Bottom Nav Clearance:** Mengoptimalkan drawer karakteristik responden di kartu mobile dengan transisi CSS Grid GPU-composited dan padding dasar `pb-28 md:pb-8` untuk mencegah tumpang tindih dengan `MobileBottomNav`.
    - **12. Enhanced Excel Export with Compact Numbered Questionnaire Columns (`/api/admin/export-profiles`):**
      - **Sheet 1 (Profil & Kuesioner):** Menambahkan 30 kolom jawaban butir kuesioner individual (`LA 1` s/d `LA 15` dan `EI 1` s/d `EI 15`) langsung di samping data profil responden dengan header warna tematik (Teal untuk LA dan Indigo untuk EI), lebar kolom ringkas (`width: 6`), dan alignment tengah.
      - **Sheet 2 (Matriks Jawaban Kuesioner):** Matriks tabular khusus skor butir dengan representasi nomor butir murni (`1` s/d `15` LA & `1` s/d `15` EI) dengan kolom ultra-kompak (`width: 5`), total skor, kategori, dan kelompok profil yang siap diolah untuk analisis statistik kuantitatif (SPSS / Python / R).
      - **Sheet 3 (Daftar Butir Pertanyaan / Codebook):** Kamus referensi lengkap yang memetakan nomor butir, instrumen, teks pernyataan kuesioner 30 butir, dan skala Likert 1-5.
    - **13. Replace ID with Sequential Numbering (`No`) on Respondent Profiles (`/admin/profil-responden`):**
      - Mengganti kolom `ID` (`#2`, `#3`, `#4`, ...) menjadi Nomor Urut (`No`: `1`, `2`, `3`, ...) pada tabel desktop dan badge nomor kartu mobile tiket responden.
    - **14. Mobile UX (mUX) Respondent Questionnaire Detail Page Redesign (`/admin/profil-responden/[id]`):**
      - **Ultra-Narrow Screen Adaptability (320px+):** Header adaptif dengan fluid typography `clamp(...)`, sequence pill indicator (`Responden X / Y`), dan penataan elemen yang elastis tanpa horizontal overflow.
      - **2-Column Bento Grid for LA & EI Metrics:** Mengubah 3 kartu bertumpuk menjadi grid 2-kolom ringkas berdampingan untuk metrik Loss Aversion (Teal) dan Emotional Intel (Indigo) di mobile, menghemat $\sim 150\text{px}$ tinggi vertikal.
      - **High-Contrast Likert 5-Scale Spectrum:** Opsi pilihan responden tampil kontras dengan colored badge, ring glow, dan checkmark, sementara opsi yang tidak dipilih dibuat muted untuk kemudahan pembacaan sekilas (*glanceable UI*).
      - **Floating Sticky Thumb-Zone Pager Bar:** Bar navigasi melayang di sepertiga bawah layar (`fixed bottom-3 left-2 right-2 z-40`) dengan tombol *Sebelumnya*, *Berikutnya*, indikator responden, dan tombol cepat *Ke Atas* yang ergonomis dijangkau satu jempol tanpa harus scroll ke ujung halaman.

