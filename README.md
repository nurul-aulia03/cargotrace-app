# CargoTrace — Global Shipment Visibility & Tracking Platform

CargoTrace adalah aplikasi berbasis web untuk mengelola, memantau, dan melacak aktivitas pengiriman barang dalam satu platform terintegrasi.

Aplikasi ini dirancang untuk memberikan visibilitas proses pengiriman, pengelolaan pesanan, pemantauan status, riwayat perjalanan, serta penanganan pengecualian pengiriman.

## Fitur Utama

- **Dashboard:** Ringkasan statistik dan aktivitas pengiriman.
- **Manajemen Pengiriman:** Pengelolaan data pengiriman barang.
- **Pelacakan Pengiriman:** Pemantauan status dan riwayat perjalanan.
- **Manajemen Armada:** Pengelolaan perusahaan dan layanan pengiriman.
- **Manajemen Lokasi:** Pengelolaan lokasi asal dan tujuan.
- **Manajemen Pesanan:** Pengelolaan pesanan pelanggan.
- **Pengecualian Pengiriman:** Pencatatan dan penanganan kendala pengiriman.
- **Notifikasi:** Informasi aktivitas dan pembaruan sistem.
- **Audit Log:** Pencatatan aktivitas pengguna.
- **Manajemen Pengguna:** Hak akses berdasarkan peran Administrator, Operator, dan Customer.

## Teknologi

| Teknologi | Kegunaan |
|---|---|
| Laravel 13 | Backend aplikasi dan REST API |
| PHP 8.3 | Bahasa pemrograman backend |
| MySQL 8.4 | Database |
| HTML, CSS, JavaScript | Antarmuka aplikasi |
| Composer | Manajemen dependensi PHP |
| Node.js & NPM | Manajemen aset frontend |
| Postman | Pengujian REST API |
| Git & GitHub | Version control dan penyimpanan source code |

## Arsitektur Sistem

![Arsitektur CargoTrace](docs/Arsitektur_CargoTrace.png)

## Entity Relationship Diagram (ERD)

![ERD CargoTrace](docs/ERD_CargoTrace.png)

## Struktur Project

```text
cargotrace-app/
├── app/
├── bootstrap/
├── config/
├── database/
├── docs/
│   ├── ERD_CargoTrace.png
│   └── Arsitektur_CargoTrace.png
├── public/
├── resources/
├── routes/
├── storage/
├── tests/
├── .env.example
├── artisan
├── composer.json
├── package.json
└── README.md
```

## Persyaratan Sistem

- PHP 8.3 atau versi yang kompatibel.
- Composer.
- MySQL 8.4 atau versi kompatibel.
- Node.js dan NPM.
- Git.

## Instalasi dan Menjalankan Aplikasi

1. Clone repository:

```bash
git clone https://github.com/USERNAME/cargotrace-app.git
cd cargotrace-app
```

2. Instal dependensi:

```bash
composer install
npm install
```

3. Salin konfigurasi environment:

```bash
cp .env.example .env
```

Pada Windows PowerShell, gunakan:

```powershell
Copy-Item .env.example .env
```

4. Buat application key:

```bash
php artisan key:generate
```

5. Buat database MySQL dengan nama `cargotrace`.

6. Sesuaikan konfigurasi database pada file `.env`:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cargotrace
DB_USERNAME=root
DB_PASSWORD=
```

7. Jalankan migrasi database:

```bash
php artisan migrate
```

8. Jalankan aplikasi:

```bash
npm run build
php artisan serve
```

Akses aplikasi melalui:

```text
http://127.0.0.1:8000
```

Catatan: Gunakan database dan akun pengujian yang telah disiapkan sendiri. Jangan memasukkan password, token, atau file `.env` ke repository publik.

## Dokumentasi REST API

REST API CargoTrace digunakan untuk mendukung komunikasi antara frontend dan backend.

Pengujian API dilakukan menggunakan Postman, mencakup autentikasi, pengguna, pengiriman, pelacakan, pesanan, pengecualian, notifikasi, dan fitur lainnya.

Base URL lokal:

```text
http://127.0.0.1:8000/api
```

## Pengujian Sistem

Pengujian dilakukan untuk memeriksa autentikasi, hak akses berdasarkan peran, pengelolaan pesanan, pengiriman, pelacakan, serta penanganan pengecualian.

Menjalankan pengujian otomatis:

```bash
php artisan test
```

## Peran Pengguna

| Peran | Hak Akses |
|---|---|
| Administrator | Mengelola dan memantau keseluruhan sistem |
| Logistics Operator | Mengelola operasional pengiriman dan pesanan |
| Customer | Membuat pesanan dan memantau pengiriman miliknya |

## Pengembang

**CargoTrace — UAS Project**

Global Shipment Visibility & Tracking Platform.

---
© 2026 CargoTrace. All rights reserved.
