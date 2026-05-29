# Panduan VPS Trading Simulasi

Dokumen ini berisi kumpulan perintah (commands) penting yang sering digunakan untuk mengelola, memperbarui, dan memantau aplikasi simulasi trading di VPS Anda.

---

## 🔄 Memperbarui Aplikasi (Update)

Lakukan langkah-langkah ini di VPS setiap kali Anda selesai melakukan perubahan kodingan di laptop dan sudah melakukan `git push` ke GitHub.

1. **Masuk ke folder proyek:**
   ```bash
   cd /var/www/trading-simulation   # Sesuaikan dengan nama folder proyek di VPS Anda
   ```

2. **Tarik kode terbaru dari GitHub:**
   ```bash
   git pull origin master
   ```

3. **Install module baru (Hanya jika ada tambahan di package.json):**
   ```bash
   npm install
   ```

4. **Kompilasi ulang aplikasi (Wajib dilakukan setiap ada perubahan kode UI/frontend):**
   ```bash
   npm run build
   ```

5. **Restart Server agar perubahan diterapkan:**
   - Jika menggunakan **PM2**:
     ```bash
     pm2 restart trading-app
     ```
   - Jika menggunakan **Docker**:
     ```bash
     docker-compose down
     docker-compose up -d --build
     ```

---

## 📊 Manajemen Server (PM2)

Perintah-perintah ini digunakan jika Anda menjalankan aplikasi menggunakan PM2 (bukan Docker).

- **Melihat daftar aplikasi yang berjalan:**
  ```bash
  pm2 status
  ```
- **Melihat log/error aplikasi secara real-time:**
  ```bash
  pm2 logs trading-app
  ```
- **Mematikan server sementara:**
  ```bash
  pm2 stop trading-app
  ```
- **Menghidupkan kembali server:**
  ```bash
  pm2 start trading-app
  ```

---

## 🗄️ Manajemen Database (Neon)

Karena database Anda berada di *cloud* (Neon), perintah ini hanya perlu dijalankan jika Anda melakukan perubahan struktur tabel (`schema.ts`) di kode Anda.

- **Menerapkan perubahan struktur tabel ke Neon:**
  ```bash
  npx drizzle-kit push
  ```
- **Mereset password admin ke default (admin123):**
  ```bash
  npm run db:set-password
  ```
- **Menambahkan data saham awal (Hanya untuk awal setup):**
  ```bash
  npm run db:seed
  ```

---

## 🛠️ Perbaikan Masalah (Troubleshooting)

Jika sewaktu-waktu aplikasi terasa lambat, *stuck*, atau terjadi error aneh di VPS, berikut langkah *reset* yang aman:

1. Matikan aplikasi:
   ```bash
   pm2 stop trading-app
   ```
2. Hapus *cache* Next.js:
   ```bash
   rm -rf .next
   ```
3. Lakukan build ulang:
   ```bash
   npm run build
   ```
4. Hidupkan kembali:
   ```bash
   pm2 start trading-app
   ```
