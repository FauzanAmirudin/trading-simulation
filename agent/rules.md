=========================================================
AI DEVELOPER GUIDELINES & BOUNDARIES
Project: Experimental Stock Trading Simulation Web App
=========================================================

1. KONTEKS PROYEK & BATASAN TEKNOLOGI (TECH STACK)
   Anda bertugas membangun aplikasi web untuk simulasi lelang/trading saham eksperimental bagi ~60 responden[cite: 5, 7].
   Anda HANYA BOLEH menggunakan teknologi berikut:

- Framework: Next.js 14+ (Wajib menggunakan App Router).
- Bahasa: TypeScript (Strict mode aktif).
- Database: PostgreSQL.
- ORM: Drizzle ORM (Dilarang menggunakan Prisma atau TypeORM).
- Real-time: Socket.io (Node.js custom server & socket.io-client).
- Styling: Tailwind CSS.
- UI Components: shadcn/ui, lucide-react & reactbits (tambahkan components yang di perlukan, menyesuaikan dengan kebutuhan website).
- Animation: framer-motion.
  BATASAN KETAT: Jangan menyarankan atau menginstal library state management pihak ketiga (seperti Redux) kecuali sangat mendesak (gunakan React Context/Zustand jika perlu). Jangan menggunakan REST API untuk fitur real-time.

2. ATURAN NEXT.JS APP ROUTER

- Default Komponen: Semua komponen di folder `app/` harus berupa Server Components secara default.
- Penggunaan "use client": Gunakan direktif "use client" HANYA pada komponen ujung daun (leaf components) yang membutuhkan: interaktivitas (onClick, onChange), React Hooks (useState, useEffect), WebSockets (socket.io-client), atau framer-motion.
- Data Fetching: Lakukan fetching data sedekat mungkin dengan tempat data itu digunakan. Gunakan Server Actions untuk mutasi data standar (misal: submit form login).

3. ATURAN DATABASE & DRIZZLE ORM

- Skema Tersentralisasi: Tulis seluruh definisi skema database pada file `src/db/schema.ts`.
- Tipe Data Kuat: Selalu gunakan fitur inferensi tipe Drizzle (`InferSelectModel`, `InferInsertModel`) untuk mendefinisikan tipe TypeScript bagi setiap tabel.
- Operasi Database: Gunakan Drizzle Query Builder. Dilarang keras menulis Raw SQL berbentuk string murni untuk menghindari SQL Injection, kecuali untuk query analitik yang sangat kompleks.

4. ATURAN WEB-SOCKETS & REAL-TIME (PENTING!)

- Matching Engine & Order Book: Logika pencocokan (jika bid == ask) [cite: 14, 16] WAJIB berjalan di sisi Server. Dilarang keras mengeksekusi logika transaksi keuangan di sisi Client.
- Manajemen Koneksi: Gunakan Singleton pattern atau React Context Provider untuk instance `socket.io-client` guna mencegah multiple connections atau memory leaks.
- Cleanup: Selalu bersihkan (cleanup) event listener socket pada fungsi `return` di dalam `useEffect` (gunakan `socket.off('eventName')`).

5. ATURAN UI/UX, SHADCN & FRAMER-MOTION

- Komponen UI: Dilarang membuat komponen dasar (Button, Input, Table, Dialog, Toast) dari nol. Selalu gunakan instalasi standar dari npx shadcn-ui@latest.
- Styling Kondisional: Selalu gunakan utility function `cn()` (clsx + tailwind-merge) yang disediakan oleh setup shadcn untuk menggabungkan class Tailwind.
- Animasi: Gunakan `framer-motion` (<motion.div>) HANYA untuk:
  a. Kilatan warna (flash) pada baris Order Book saat ada order masuk atau match.
  b. Transisi halus saat pergantian sesi saham (fade in/out)[cite: 26, 28].
  c. Animasi masuk (slide) untuk fitur Running Text / Berita dari Admin[cite: 31, 32].

6. STRUKTUR FOLDER YANG DIHARAPKAN
   Ikuti struktur ini agar rapi:
   /src
   /app (Routes, Pages, Layouts)
   /components (UI components, shadcn, custom widgets)
   /db (Drizzle schema, db connection, migrations)
   /lib (Utility functions, socket client init, cn helper)
   /server (Socket.io server logic, Matching Engine algorithms)

7. KEAMANAN & EFISIENSI

- Jangan pernah mengirim (expose) seluruh data tabel Users ke client. Hanya kirim data yang relevan untuk sesi berjalan.
- Pastikan algoritma sinkronisasi Timer Sesi berpusat pada Server, klien hanya menerima sisa waktu (countdown) agar tidak bisa dimanipulasi oleh device pengguna.

PATUHI PEDOMAN INI SECARA KETAT SEBELUM MENGHASILKAN KODE APA PUN.
