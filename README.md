<div align="center">
  <h1>📈 Trading Simulation & Experimental Platform</h1>
  <p>A full-stack real-time stock trading simulation and behavioral economics experimental research platform.</p>
</div>

---

## 📖 Overview

**Trading Simulation** adalah platform web interaktif eksperimental komprehensif yang dirancang untuk riset ekonomi perilaku (*behavioral economics*), psikologi keuangan, dan simulasi pasar modal.

Platform ini menggabungkan **Central Limit Order Book (CLOB) matching engine** berbasis **Socket.io**, matriks penjadwalan multi-periode (4 sesi uji coba + 3 periode utama) dengan intervensi berita asimetris, tampilan harga historis beruntun (`t-3` → `t-2` → `t-1`), instrumen profil psikologis *Population Terciles* (*Loss Aversion* & *Emotional Intelligence*), formulir demografi/biodata dinamis, kuesioner evaluasi pasca-simulasi, pusat **Auto-Backup ZIP**, serta isolasi penuh akun demo terhadap data penelitian.

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
- **Autentikasi & Keamanan:** BcryptJS password hashing, signed HMAC session cookie, idle auto-timeout watchdog
- **Export & Pelaporan:** [ExcelJS](https://github.com/exceljs/exceljs) (Multi-sheet styled XLSX + formula dinamis), [Sharp](https://sharp.pixelplumbing.com/) (SVG-to-PNG chart rendering), & [Archiver](https://www.archiverjs.com/) (`ZipArchive` bundled backups)
- **Containerization:** Docker & Docker Compose (Multi-stage production build dengan persistent `./backups` volume)

---

## 🏗️ Project Structure

```text
trading-simulasi/
├── backups/                  # Direktori penyimpanan arsip backup otomatis (.zip & .json)
├── drizzle/                  # Drizzle ORM migrations & seed_100_respondents.sql
├── public/                   # Static assets, logo institusi, dan favicon
├── src/
│   ├── app/                  # Next.js App Router (Halaman & Endpoint API)
│   │   ├── admin/            # Panel Kontrol Eksperimen (Admin)
│   │   │   ├── backup/       # Pusat Monitoring & Manajemen Cadangan Data (ZIP & JSON)
│   │   │   ├── biodata/      # Analitik demografi peserta, durasi investasi & filter profil
│   │   │   ├── evaluasi/     # Analitik hasil evaluasi akhir simulasi (10 pertanyaan)
│   │   │   ├── hasil/        # Leaderboard real-time, NAV, PnL, dan peringkat kekayaan
│   │   │   ├── kuesioner/    # Monitoring respons instrumen psikologis LA & EI
│   │   │   ├── profil-responden/ # Matriks 9 kelompok profil (A-I) & detail responden
│   │   │   ├── resume/       # Rekapitulasi transaksi, volume perdagangan & ekspor modal
│   │   │   └── trading/      # Live surveillance monitor order book pasar aktif
│   │   ├── api/              # REST Endpoints
│   │   │   ├── admin/        # API admin (backup, ekspor XLSX, recalculate, audit)
│   │   │   ├── evaluation/   # Pengumpulan & status evaluasi pasca-simulasi
│   │   │   ├── questionnaire/# Pengumpulan biodata & kuesioner psikologis
│   │   │   ├── session/      # State machine kontrol ronde, intervensi, & penjadwalan
│   │   │   └── stocks/       # Data master emiten saham dan harga historis
│   │   ├── dashboard/        # Antarmuka Peserta / Responden
│   │   │   ├── page.tsx      # Terminal portofolio (36 saham resmi), saldo kas & aset
│   │   │   └── trading/      # Terminal perdagangan aktif, t-3/t-2/t-1, order book & chart
│   │   ├── login/            # Halaman otentikasi login multi-role (Admin & Responden)
│   │   └── questionnaire/    # Pengisian biodata, instrumen LA & EI, dan evaluasi
│   │       └── evaluation/   # Kuesioner evaluasi akhir (terkunci otomatis hingga simulasi selesai)
│   ├── components/           # Komponen UI modular
│   │   ├── admin/            # Scheduler board, modal ekspor, dialog reset 3-level
│   │   ├── auth/             # QuestionnaireGuard (alur wajib kuesioner) & SessionTimeoutModal
│   │   ├── layout/           # AppSidebar, Navbar, Footer, MobileBottomNav
│   │   ├── trading/          # Running text berita intervensi, order book depth, tick input
│   │   └── ui/               # Primitives Shadcn UI (PriceInput default 0, Button, Card, Table)
│   ├── db/                   # Konfigurasi database, skema, dan seeding
│   │   ├── schema.ts         # Skema Drizzle (Users, Stocks t-1/t-2/t-3, Rounds, Biodata, Evaluasi, dsb.)
│   │   ├── stocks-data.ts    # Master 36 saham utama (S-1..S-36) & 12 saham uji coba (AA..DC)
│   │   ├── init.ts           # Inisialisasi basis data terpadu & idempoten (100 responden)
│   │   ├── seed.ts           # Seeder 48 emiten saham & akun Admin
│   │   ├── seed-users.ts     # Seeder 100 akun responden massal + 4 akun demo
│   │   ├── seed-responses.ts # Seeder lengkap 100 responden (biodata, kuesioner, profil, evaluasi)
│   │   ├── seed-questionnaire.ts # Seeder 30 item instrumen psikologis (15 LA & 15 EI)
│   │   └── reset-experiment.ts   # Script utilitas pembersihan transaksi eksperimen
│   └── lib/                  # Library pembantu & logika bisnis
│       ├── exports/          # Generator Excel resmi terpadu (single source of truth)
│       ├── backup-service.ts # Mesin pembundelan ZIP cadangan seluruh ekspor resmi + JSON
│       ├── demo-users.ts     # Filter isolasi 4 akun demo (Andi, Budi, Citra, Doni)
│       ├── experimental-matrix.ts # Matriks Periode 0 (4 Sesi Uji Coba) & Periode 1-3
│       ├── questionnaire-logic.ts # Algoritma Population Terciles (T/S/R) & Matriks 9 Grup (A-I)
│       ├── market-rules.ts   # Regulasi BEI: Fraksi harga (Tick Size) & Auto Rejection (ARA/ARB)
│       ├── evaluation-questions.ts # Definisi pertanyaan & skala Likert evaluasi akhir
│       ├── socket.ts         # Klien Socket.io dengan auto-reconnect
│       └── auth-context.tsx  # Context autentikasi, sinkronisasi profil, & idle watchdog
├── server.ts                 # Custom Node.js + Socket.io Server (CLOB matching engine & scheduler)
├── Dockerfile                # Multi-stage production container build
├── docker-compose.yml        # Orkestrasi Docker (Next.js App + PostgreSQL + pgAdmin)
├── drizzle.config.ts         # Konfigurasi migrasi Drizzle Kit
├── next.config.ts            # Konfigurasi Next.js (Strict mode, asset optimization)
└── package.json              # Dependensi modul & automasi skrip npm
```

---

## ✨ Fitur-Fitur Utama

### 1. ⚙️ Terminal Trading Real-Time & Harga Historis (`t-3` → `t-2` → `t-1`)
- **Tampilan Harga Historis Berurutan:** Pada setiap kartu saham, header terminal trading, maupun *PriceChart*, sistem menampilkan rentang harga historis **`t-3` → `t-2` → `t-1 (Harga Penutupan H-1)`** secara berdampingan dengan `t-1` di posisi paling kanan sebagai acuan utama untuk ke-36 saham utama (`S-1` s/d `S-36`) dan 12 saham uji coba (`AA` s/d `DC`).
- **Input Harga Mandiri (Default `0`):** Kolom input *Harga Order / Prediksi* dimulai dari angka **`0`** (tidak terisi otomatis oleh harga pembukaan) agar responden menentukan nominal harga beli/jual secara independen.
- **CLOB Matching Engine (FIFO Price-Time Priority):** Pencocokan antrean *Bid* dan *Ask* secara deterministik di `server.ts`, disertai modal **Hasil Pencocokan Transaksi Akhir Sesi** dengan keterangan `Harga Match`, `Harga Order`, atau `Harga Open`.
- **Kepatuhan Regulasi BEI:** Validasi otomatis **Fraksi Harga (Tick Size)** dan batas **Auto Rejection Atas/Bawah (ARA/ARB)** di frontend dan backend (`Peng-00067/BEI.POP/04-2026`).

### 2. 🧪 Matriks Eksperimen: 4 Sesi Uji Coba + 3 Periode Utama
- **Periode 0 (Periode Uji Coba — 4 Sesi):**
  - **Sesi Uji Coba 1:** `AA`, `AB`, `AC`
  - **Sesi Uji Coba 2:** `BA`, `BB`, `BC`
  - **Sesi Uji Coba 3:** `CA`, `CB`, `CC`
  - **Sesi Uji Coba 4:** `DA`, `DB`, `DC`
  - Saham uji coba diisolasi (`is_trial = true`) agar tidak memengaruhi laporan hasil resmi 36 saham.
- **Periode I – III (36 Saham Utama `S-1` s/d `S-36`):**
  - Mendukung injeksi berita asimetris (`BERITA_BAIK`, `BERITA_BURUK`, `NONE`) dengan *running text ticker* di layar peserta.

### 3. 🧠 Profiling Psikologis *Population Terciles* (Adaptif & Seimbang)
- **Instrumen Kuesioner:** 15 butir *Loss Aversion* (LA) + 15 butir *Emotional Intelligence* (EI) dengan **Petunjuk Pengisian** skala 1–5 (`1 = sangat tidak sesuai` s/d `5 = sangat sesuai`).
- **Algoritma Population Terciles:** Secara otomatis mengurutkan total skor seluruh responden yang telah mengisi dari tertinggi ke terendah dan membagi menjadi 3 kelompok seimbang (**Tinggi 33.3%**, **Sedang 33.3%**, **Rendah 33.3%**) — adaptif untuk jumlah populasi berapapun mulai dari $N \ge 3$ (misal: $N=3 \rightarrow 1:1:1$, $N=100 \rightarrow 34:33:33$) dan dipetakan ke **Matriks 9 Kuadran (Grup A – I)**.

### 4. 📋 Formulir Biodata Kondisional & Route Protection
- Mengumpulkan 8 butir demografi peserta termasuk **pertanyaan kondisional lama pengalaman investasi saham**: jika responden memilih `Ya` pada riwayat investasi saham, muncul dropdown angka (`1–10` dan `Lainnya > 10` beserta input manual) dan dropdown satuan (`Bulan` / `Tahun`).
- **QuestionnaireGuard:** Mengunci akses terminal trading hingga biodata dan kuesioner LA/EI selesai diisi, serta mengarahkan peserta ke evaluasi akhir (`/questionnaire/evaluation`) setelah Periode 3 Sesi 4 berakhir.

### 5. 🛡️ Isolasi Akun Demo (`Andi`, `Budi`, `Citra`, `Doni`)
- Ke-4 akun personal demo tetap dapat digunakan untuk simulasi/demonstrasi kapan pun, namun **diisolasi 100%** dari seluruh data riset resmi:
  - Tidak diikutsertakan dalam pemeringkatan *Population Terciles* LA/EI.
  - Disembunyikan dari seluruh tampilan dashboard admin (`/admin/biodata`, `/admin/profil-responden`, `/admin/evaluasi`, `/admin/hasil`, `/admin/resume`, `/admin/kuesioner`).
  - Tidak masuk ke dalam berkas ekspor laporan Excel mana pun.

### 6. 🗄️ Pusat Backup (`/admin/backup`), Auto-Backup ZIP & Reset 3 Level
- **Reset 3 Level (`ResetDialog.tsx`):**
  - **Level 1 (Reset State Saja):** Menghentikan timer/sesi dan mengembalikan status ke `IDLE` tanpa menghapus data transaksi.
  - **Level 2 (Reset Sesi & Batalkan Order):** Semua aksi Level 1 + membatalkan antrean *open orders*.
  - **Level 3 (Reset Penuh dari Nol / Hard Reset):** Secara otomatis mengeksekusi **Auto-Backup ZIP** ke `backups/` terlebih dahulu, lalu menghapus bersih seluruh data transaksi, order book, prediksi, ronde, biodata, kuesioner, profil, dan evaluasi serta mengembalikan saldo ke Rp 100.000.000 & portofolio ke 10 lot agar eksperimen dimulai murni dari nol.
- **Halaman Monitoring Backup (`/admin/backup`):** Memantau riwayat arsip cadangan di server, membuat snapshot baru secara instan, atau mengunduh paket ZIP/JSON.
- **Single Source of Truth Ekspor Resmi:** Paket ZIP backup membundel berkas-berkas Excel yang **100% identik** nama, template, grafik, rumus Excel, dan isinya dengan ekspor di tiap halaman admin:
  - `Laporan_Biodata_Responden_YYYY-MM-DD.xlsx`
  - `Laporan_Profil_Psikologis_Responden_YYYY-MM-DD.xlsx`
  - `Rekap_Evaluasi_Simulasi_YYYY-MM-DD.xlsx`
  - `Laporan_Trading_Semua_Sesi.xlsx`
  - `Laporan_OrderBook_Semua_Sesi.xlsx`
  - `Laporan_Hasil_Semua_Sesi.xlsx` *(Sheet 1 `Ranking Kekayaan` + Sheet individual per user berurutan dari `responden1` s/d `responden100` dengan kolom `Harga Open`)*
  - `snapshot_database_lengkap.json`

---

## 🛠️ Instalasi & Setup (Local Development)

### 1. Prasyarat Sistem
- [Node.js](https://nodejs.org/) (Versi 20 LTS atau lebih baru disarankan)
- [PostgreSQL](https://www.postgresql.org/) database (Lokal atau Docker)
- npm

### 2. Kloning Repositori & Install Dependensi
```bash
git clone https://github.com/FauzanAmirudin/trading-simulation.git
cd trading-simulation
npm install
```

### 3. Konfigurasi Environment Variables
Salin berkas `.env.example` menjadi `.env` dan sesuaikan `DATABASE_URL`:
```bash
cp .env.example .env
```
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/trading_simulasi
```

### 4. Inisialisasi Basis Data & Seeding
```bash
# Push skema Drizzle ke basis data
npm run db:push

# Inisialisasi data master (48 saham, akun Admin, 100 responden, 30 butir kuesioner)
npm run db:init
```

> [!TIP]
> **Daftar Skrip Database Mandiri:**
> - `npm run db:seed`: Sync 48 emiten saham (`S-1..S-36` & `AA..DC`) + akun Admin
> - `npm run db:seed:users`: Seed 100 akun responden (`responden1` s/d `responden100`) + 4 akun demo
> - `npm run db:seed:100` / `npm run db:seed:responses`: Seed lengkap data 100 responden (biodata, kuesioner, profil, evaluasi, portofolio) & menghasilkan `drizzle/seed_100_respondents.sql`
> - `npm run db:seed:questionnaire`: Seed 30 instrumen pertanyaan LA & EI
> - `npm run db:reset`: Reset data order book dan transaksi eksperimen tanpa menghapus akun

### 5. Menjalankan Aplikasi
Jalankan server terintegrasi Socket.io dan Next.js:
```bash
npm run dev
# atau
npm run dev:server
```
> **Catatan:** Selalu gunakan `npm run dev` / `npm run dev:server` (menjalankan `tsx watch server.ts`), bukan `next dev` standar, agar Socket.io dan matching engine aktif di port `3000`.

Aplikasi dapat diakses di: **`http://localhost:3000`**

---

## 🐳 Panduan Deployment & Pembaruan Docker (Production Server)

### 1. Konfigurasi `.env` Server
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

### 2. Build & Jalankan Pertama Kali
```bash
docker compose up -d --build
docker compose logs -f app
```

### 3. Memperbarui Aplikasi di Server Docker Setelah `git push`
```bash
# 1. Tarik kode terbaru dari GitHub
git pull origin master

# 2. Build ulang dan jalankan container aplikasi (tanpa mengganggu database)
docker compose up -d --build app

# 3. (Opsional) Seed 100 responden lengkap langsung via SQL jika belum ada
docker compose exec -T postgres psql -U postgres -d trading_simulasi < drizzle/seed_100_respondents.sql
```

*(Folder `./backups` di host server otomatis ter-mount ke `/app/backups` di dalam container sehingga berkas arsip ZIP cadangan tetap aman saat rebuild).*

---

## 👤 Daftar Akun Bawaan (Default Credentials)

| Peran (Role) | Username | Password | Deskripsi & Hak Akses |
| :--- | :--- | :--- | :--- |
| **Administrator** | `Admin` | `admin` | Kontrol penuh: Penjadwalan 4 sesi uji coba + 3 periode, surveillance live, analitik, monitoring backup ZIP, dan ekspor laporan. |
| **Responden Resmi** | `responden1` s/d `responden100` | `password123` | Akun peserta penelitian resmi (Modal awal: Rp 100.000.000 tunai + 10 lot pada seluruh saham). |
| **Akun Demo (Terisolasi)** | `Andi`, `Budi`, `Citra`, `Doni` | `password` | Akun demo/uji coba mandiri — aksinya terisolasi penuh dan tidak masuk ke data riset maupun laporan Excel admin. |

---

## 📝 Lisensi & Hak Penggunaan

Platform ini dibangun untuk kebutuhan riset akademik, studi ekonomi perilaku, dan eksperimen keuangan terapan. Segala bentuk modifikasi, penggunaan komersial, maupun redistribusi wajib mencantumkan atribusi kepada pemilik repositori.
