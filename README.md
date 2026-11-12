<div align="center">
  <h1>📈 Trading Simulation & Experimental Platform</h1>
  <p>A full-stack real-time stock trading simulation and behavioral economics experimental research platform.</p>
</div>

---

## 📖 Overview

**Trading Simulation** adalah platform web interaktif eksperimental komprehensif yang dirancang untuk riset ekonomi perilaku (*behavioral economics*), psikologi keuangan, dan simulasi pasar modal. 

Platform ini menggabungkan **Central Limit Order Book (CLOB) matching engine** *real-time* berbasis **Socket.io**, matriks penjadwalan multi-periode dengan intervensi asimetris (berita baik & buruk), instrumen profil psikologis responden (*Loss Aversion* & *Emotional Intelligence*), instrumen demografi/biodata, serta kuesioner evaluasi akhir simulasi yang terintegrasi secara *end-to-end*.

---

## 🚀 Tech Stack

### Frontend
- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Styling & Theming:** [Tailwind CSS v4](https://tailwindcss.com/) & [next-themes](https://github.com/pacocoursey/next-themes) (Light / Dark mode dinamis)
- **Animasi:** [Framer Motion](https://www.framer.com/motion/) & [tw-animate-css](https://github.com/your-username/tw-animate-css)
- **Komponen UI:** [Shadcn UI](https://ui.shadcn.com/) & [Base UI](https://base-ui.com/)
- **Notifikasi & Interaksi:** [Sonner](https://sonner.emilkowal.ski/)
- **Visualisasi Ikon:** [Lucide React](https://lucide.dev/)

### Backend & Real-Time Engine
- **Custom Real-Time Server:** Node.js + [Socket.io](https://socket.io/) (`server.ts`)
- **Database:** PostgreSQL (v15+)
- **ORM & Migrations:** [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit
- **Autentikasi & Keamanan:** BcryptJS password hashing, stateful session cookie, idle auto-timeout safeguard
- **Export & Pelaporan:** [ExcelJS](https://github.com/exceljs/exceljs) (Multi-sheet styled XLSX) & [Archiver](https://www.archiverjs.com/) (ZIP bundled archives)
- **Containerization:** Docker & Docker Compose (Multi-stage production build)

---

## 🏗️ Project Structure

```text
trading-simulasi/
├── drizzle/                  # Drizzle ORM migration outputs & SQL snapshots
├── public/                   # Static assets, logo institusi, dan favicon
├── src/
│   ├── app/                  # Next.js App Router (Halaman & Endpoint API)
│   │   ├── admin/            # Panel Kontrol Eksperimen (Admin)
│   │   │   ├── biodata/      # Analitik demografi peserta & filter profil
│   │   │   ├── evaluasi/     # Analitik hasil evaluasi akhir simulasi (10 pertanyaan)
│   │   │   ├── hasil/        # Leaderboard real-time, NAV, PnL, dan peringkat kekayaan
│   │   │   ├── kuesioner/    # Monitoring respons instrumen psikologis LA & EI
│   │   │   ├── profil-responden/ # Matriks 9 kelompok profil psikologis (A s/d I) & detail responden
│   │   │   ├── resume/       # Rekapitulasi transaksi, volume perdagangan & ekspor modal
│   │   │   └── trading/      # Live surveillance monitor order book pasar aktif
│   │   ├── api/              # REST Endpoints
│   │   │   ├── admin/        # API internal admin (ekspor XLSX/ZIP, recalculate, reset, audit)
│   │   │   ├── evaluation/   # Pengumpulan & status evaluasi pasca-simulasi
│   │   │   ├── questionnaire/# Pengumpulan biodata & kuesioner psikologis
│   │   │   ├── session/      # State machine kontrol ronde, intervensi, & penjadwalan
│   │   │   └── stocks/       # Data master 36 emiten saham dan base price
│   │   ├── dashboard/        # Antarmuka Peserta / Responden
│   │   │   ├── page.tsx      # Terminal portofolio, saldo kas, dan daftar aset
│   │   │   └── trading/      # Terminal perdagangan aktif, order book live, & chart pergerakan harga
│   │   ├── login/            # Halaman otentikasi login multi-role (Admin & Responden)
│   │   └── questionnaire/    # Pengisian biodata, instrumen LA & EI, dan evaluasi
│   │       └── evaluation/   # Kuesioner evaluasi akhir (terkunci otomatis hingga simulasi selesai)
│   ├── components/           # Komponen UI modular
│   │   ├── admin/            # Scheduler board, modal ekspor, dialog reset darurat
│   │   ├── auth/             # QuestionnaireGuard (alur wajib kuesioner) & SessionTimeoutModal
│   │   ├── layout/           # AppSidebar, Navbar, Footer, MobileBottomNav
│   │   ├── trading/          # Running text berita intervensi, order book depth, tick input
│   │   └── ui/               # Primitives Shadcn UI (PriceInput, Button, Card, Table, dsb.)
│   ├── db/                   # Konfigurasi database, relasi skema, dan seeding
│   │   ├── schema.ts         # Skema Drizzle (Users, Stocks, Rounds, OrderBook, Biodata, Evaluasi, dsb.)
│   │   ├── init.ts           # Inisialisasi basis data terpadu & idempoten
│   │   ├── seed.ts           # Seeder 36 emiten saham BEI & akun Admin
│   │   ├── seed-users.ts     # Seeder 30 akun responden massal
│   │   ├── create-users.ts   # Seeder akun personal responden (Andi, Budi, Citra, Doni)
│   │   ├── seed-questionnaire.ts # Seeder 30 item instrumen psikologis (15 LA & 15 EI)
│   │   └── reset-experiment.ts   # Script utilitas pembersihan transaksi eksperimen
│   └── lib/                  # Library pembantu & logika bisnis
│       ├── experimental-matrix.ts # Logika matriks sesi, periode (1-3), ronde, dan intervensi
│       ├── market-rules.ts   # Regulasi BEI: Fraksi harga (Tick Size) dan Auto Rejection (ARA/ARB)
│       ├── evaluation-questions.ts # Definisi pertanyaan & skala Likert evaluasi akhir
│       ├── socket.ts         # Klien Socket.io dengan auto-reconnect
│       └── auth-context.tsx  # Context autentikasi, sinkronisasi profil, & idle watchdog
├── server.ts                 # Custom Node.js + Socket.io Server (CLOB matching engine 750ms)
├── Dockerfile                # Multi-stage production container build
├── docker-compose.yml        # Orkestrasi Docker (Next.js App + PostgreSQL + pgAdmin)
├── drizzle.config.ts         # Konfigurasi migrasi Drizzle Kit
├── next.config.ts            # Konfigurasi Next.js (Strict mode, asset optimization)
└── package.json              # Dependensi modul & automasi skrip npm
```

---

## ✨ Fitur-Fitur Lengkap (Detailed Features)

### 1. ⚙️ Real-Time Central Limit Order Book (CLOB) Matching Engine
- **Price-Time Priority:** Algoritma eksekusi order otomatis dengan interval pencocokan berkala setiap **750ms** pada `server.ts`.
- **Live Bid/Ask Depth:** Antarmuka terminal perdagangan memperbarui kedalaman antrean permintaan (*bid*) dan penawaran (*ask*) secara instan tanpa perlu memuat ulang halaman (*zero-refresh*).
- **In-Memory Order Tracking:** Pencatatan dan validasi instan terhadap saldo kas dan sisa kepemilikan lot portofolio responden guna mencegah *double spending* atau *short selling*.

### 2. 🏛️ Regulasi Bursa Efek Indonesia (BEI) Compliance
Sistem trading mengadopsi mekanisme regulasi perdagangan saham nyata sesuai acuan BEI:
- **Aturan Fraksi Harga (Tick Size):**
  - `< Rp 200`: Fraksi Rp 1
  - `Rp 200 - Rp 500`: Fraksi Rp 2
  - `Rp 500 - Rp 2.000`: Fraksi Rp 5
  - `Rp 2.000 - Rp 5.000`: Fraksi Rp 10
  - `≥ Rp 5.000`: Fraksi Rp 25
  - Dilengkapi tombol *Quick Price Chips* (prediksi naik/turun persentase) dan tombol penyesuaian fraksi (+/-) otomatis.
- **Auto Rejection Atas (ARA) & Auto Rejection Bawah (ARB):**
  - Proteksi batas pergerakan harga maksimal harian/ronde (35% untuk saham ≤ Rp 200; 25% untuk saham Rp 200 - Rp 5.000; 20% untuk saham > Rp 5.000) yang divalidasi langsung di frontend dan backend.

### 3. 🧪 State Machine & Matriks Eksperimen Multi-Periode
- **Struktur Matriks Eksperimen:**
  - Terdiri dari **3 Periode Utama** dengan masing-masing **4 Sesi Sub-Putaran**.
  - Setiap putaran mengaktifkan 3 saham pilihan dari total 36 emiten saham terdaftar.
- **Fase Putaran Dinamis:**
  - `PRE_MARKET` (Pra-Pasar): Peserta melakukan tebakan/prediksi harga pembukaan serta latihan penempatan order *Bid*/*Ask* uji coba tanpa mengurangi saldo uang riil.
  - `TRADING` (Pasar Aktif): Perdagangan live continuous trading dengan pencocokan riil di engine CLOB.
  - `COOLDOWN`: Jeda kalkulasi hasil transaksi, rekap laba/rugi, dan transisi ke putaran selanjutnya.
- **Injeksi Intervensi Eksperimen:**
  - Fasilitas penyampaian berita terprogram: `BERITA_BAIK` (Good News), `BERITA_BURUK` (Bad News), atau `NONE` (Kontrol).
  - Tampilan *running text* *ticker tape* berjalan di layar terminal trading peserta untuk menguji respons psikologis terhadap informasi asimetris.

### 4. 🧠 Profiling Psikologis Responden (Loss Aversion & Emotional Intelligence)
- **Instrumen Kuesioner Komprehensif:** 30 butir pertanyaan skala Likert (15 butir untuk mengukur kecenderungan *Loss Aversion* / keengganan merugi, dan 15 butir untuk *Emotional Intelligence* / kecerdasan emosional).
- **Pengelompokan Otomatis Matriks 9 Kuadran (Group A – I):**
  - Kombinasi otomatis dari skor LA (Tinggi / Sedang / Rendah) dan EI (Tinggi / Sedang / Rendah) menghasilkan profil seperti `LATEIT` (Kelompok A) hingga `LAREIR` (Kelompok I).
  - Dilengkapi fitur *Recalculate Scores* di panel admin apabila ada penyesuaian batas kategori skor.

### 5. 📋 Biodata & Demografi Peserta
- **Formulir Biodata Interaktif:** Pengumpulan data demografi awal mencakup jenis kelamin, rentang usia, program studi, semester, pengalaman investasi saham nyata, riwayat pelatihan pasar modal, sumber penghasilan, dan latar belakang jurusan SMA.
- **Questionnaire Guard:** Mekanisme *route protection* cerdas; peserta yang belum melengkapi biodata atau kuesioner psikologis secara otomatis dialihkan ke halaman instrumen sebelum diizinkan mengakses terminal perdagangan.

### 6. 📝 Evaluasi Pasca-Simulasi (Post-Simulation Evaluation)
- **Evaluasi 10 Pertanyaan:** Kuesioner evaluasi komprehensif terkait pengalaman simulasi, persepsi risiko, pemahaman mekanisme pasar, dan pengaruh berita yang dihadapi peserta.
- **Sistem Penguncian Terprogram:** Halaman `/questionnaire/evaluation` terkunci secara cerdas dan baru dapat diakses setelah seluruh rangkaian perdagangan simulasi (Periode 3 Sesi 4) dinyatakan selesai oleh Admin.

### 7. 🛡️ Keamanan & Pemantauan Sesi (Idle Timeout Watchdog)
- **Sesi Otomatis & Pemantauan Keaktifan:** Deteksi aktivitas pengguna (gerakan mouse, penekanan keyboard, sentuhan layar).
- **Modal Peringatan Countdown:** Jika pengguna tidak aktif selama periode tertentu, modal peringatan mengambang akan muncul dengan hitung mundur detik sebelum sesi dikeluarkan secara aman (*auto-logout*).

### 8. 📊 Dashboard Kontrol & Analisis Peneliti (Admin Panel)
- **Penjadwal Putaran (`/admin`):** Kontrol peluncuran putaran, jeda, reset, serta pengaturan intervensi per periode secara fleksibel.
- **Live Market Surveillance (`/admin/trading`):** Memantau arus order book dan transaksi berjalan antar peserta secara langsung.
- **Leaderboard & Hasil (`/admin/hasil`):** Peringkat peserta *real-time* berdasarkan *Net Asset Value* (NAV), saldo kas tunai, total valuasi portofolio saham, persentase *Return/PnL*, dan frekuensi transaksi.
- **Rekapitulasi Pasar (`/admin/resume`):** Ringkasan volume perputaran uang, rata-rata transaksi, dan histori log transaksi per tanggal eksperimen.
- **Analitik Biodata & Evaluasi (`/admin/biodata` & `/admin/evaluasi`):** Visualisasi statistik demografi dan distribusi jawaban instrumen evaluasi dalam bentuk diagram persentase dan ringkasan metrik.
- **Profil Responden (`/admin/profil-responden`):** Distribusi sebaran kelompok A–I dan rincian jawaban per individu responden.

### 9. 📥 Sistem Ekspor Laporan Riset Mutakhir
- **Multi-Sheet Styled Excel (`.xlsx`):** Laporan data berformat rapi menggunakan library ExcelJS, lengkap dengan filter tanggal eksperimen dan pemisahan tab:
  - Tab Transaksi & Riwayat Order
  - Tab Evaluasi Portofolio & NAV
  - Tab Profil Jawaban LA & EI Responden
  - Tab Data Demografi & Biodata
  - Tab Hasil Kuesioner Evaluasi Akhir
- **ZIP Bundling Archive:** Kemudahan mengunduh seluruh berkas ekspor data mentah secara kolektif dalam satu arsip terkompresi.

---

## 🛠️ Instalasi & Setup (Local Development)

### 1. Prasyarat Sistem
- [Node.js](https://nodejs.org/) (Versi 20 LTS atau lebih baru disarankan)
- [PostgreSQL](https://www.postgresql.org/) database (Lokal atau Cloud instance)
- npm / yarn / pnpm

### 2. Kloning Repositori
```bash
git clone https://github.com/FauzanAmirudin/trading-simulation.git
cd trading-simulation
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment Variables
Salin berkas template `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Sesuaikan konfigurasi string koneksi `DATABASE_URL` pada `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/trading_simulasi
```

### 5. Inisialisasi Basis Data & Seeding Otomatis
Jalankan migrasi skema dan *idempotent database initializer*:
```bash
# Push skema Drizzle ke basis data
npm run db:push

# Inisialisasi & seed seluruh data (36 saham, akun Admin, 34 responden, 30 butir kuesioner)
npm run db:init
```

> [!TIP]
> **Daftar Skrip Database Mandiri:**
> - `npm run db:seed`: Seed saham & akun admin saja
> - `npm run db:seed:users`: Seed 30 akun responden massal
> - `npm run db:create-users`: Seed akun responden bernama (Andi, Budi, Citra, Doni)
> - `npm run db:seed:questionnaire`: Seed 30 instrumen pertanyaan LA & EI
> - `npm run db:reset`: Reset data order book dan transaksi eksperimen tanpa menghapus akun

### 6. Menjalankan Aplikasi
Jalankan server terintegrasi Socket.io dan Next.js:
```bash
npm run dev:server
# atau
npm run dev
```
*Aplikasi akan berjalan dan dapat diakses di: `http://localhost:3000`.*

---

## 🐳 Panduan Deployment Docker (Production Server)

### 1. Konfigurasi `.env` Server
Buat berkas `.env` pada direktori root server:
```env
PORT=3000
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
POSTGRES_DB=trading_simulasi
DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/trading_simulasi
PGADMIN_EMAIL=admin@trading.com
PGADMIN_PASSWORD=admin
```

### 2. Build & Jalankan Kontainer
```bash
# Build dan jalankan seluruh container (Aplikasi + PostgreSQL + pgAdmin) di latar belakang
docker compose up -d --build

# Pantau log server real-time
docker compose logs -f app
```

Kontainer aplikasi otomatis menerapkan sinkronisasi skema Drizzle, mengeksekusi seed terpadu `src/db/init.ts` secara idempoten, dan memulai *Node.js Socket.io matching engine server*.

---

## 👤 Daftar Akun Bawaan (Default Credentials)

| Peran (Role) | Username | Password | Deskripsi & Hak Akses |
| :--- | :--- | :--- | :--- |
| **Administrator** | `Admin` | `admin` | Akses kontrol penuh: Penjadwalan eksperimen, monitoring surveillance, analitik kuesioner, evaluasi, dan ekspor laporan XLSX/ZIP. |
| **Responden Massal** | `responden1` s/d `responden30` | `password123` | Akun peserta penelitian standar (Modal awal: Rp 100.000.000 tunai + 10 lot pada seluruh saham). |
| **Responden Personal** | `Andi`, `Budi`, `Citra`, `Doni` | `password` | Akun peserta pengujian mandiri (Modal awal: Rp 100.000.000 tunai + 10 lot pada seluruh saham). |

---

## 📝 Lisensi & Hak Penggunaan

Platform ini dibangun untuk kebutuhan riset akademik, studi ekonomi perilaku, dan eksperimen keuangan terapan. Segala bentuk modifikasi, penggunaan komersial, maupun redistribusi wajib mencantumkan atribusi kepada pemilik repositori.
