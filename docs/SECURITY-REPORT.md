# Laporan Keamanan Nalar

Pemeriksaan dilakukan bertahap pada aplikasi lokal. Laporan ini tidak memuat nilai env, key, token, email asli, atau data pribadi.

## Kelompok A — Rahasia dan konfigurasi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| A1 | `.env` diabaikan Git dan file env ter-track | LULUS | Hanya file contoh yang ter-track; file env lokal diabaikan. | Rendah |
| A2 | Riwayat Git untuk pola secret | LULUS | Pencarian pola yang ditentukan tidak menemukan kandidat secret nyata; temuan berasal dari placeholder file contoh. | Rendah |
| A3 | Kekuatan `JWT_SECRET` | LULUS setelah perbaikan | Saat startup, produksi berhenti jika secret kosong atau kurang dari 32 karakter; development memberi peringatan tanpa mencetak nilainya. Pemeriksaan langsung juga menolak secret pendek di produksi. | Sedang — ditangani |
| A4 | Variabel `NEXT_PUBLIC_*` | LULUS | Kode frontend hanya membaca `NEXT_PUBLIC_API_URL`, yaitu URL API publik. Pemilik akan membetulkan nama variabel lokal sendiri; nilainya tidak diperiksa atau ditampilkan. | Rendah |
| A5 | `npm audit` | GAGAL lalu DITUNDA ke Task 5.6 | Audit melaporkan 3 temuan berlabel High di rantai Prisma/deepmerge-ts dan 7 Moderate di rantai minimatch. Peninjauan menggolongkan dampaknya sebagai risiko DoS berisiko rendah; tidak ada `npm audit fix --force` dan tidak ada pembaruan dependensi pada kelompok ini. Prisma tetap versi 6. | Rendah — diterima sementara |
| A6 | Endpoint health publik | LULUS | Health check hanya memberi status umum dan tidak mengembalikan host, nama database, atau versi. | Rendah |

## Kelompok B — Autentikasi dan sesi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| B1 | Rute dan middleware autentikasi | LULUS untuk rute data; logout no-op publik ditunda ke Task 5.6 | Rute data memakai `requireAuth`; `POST /auth/logout` tanpa token memberi 200, tetapi tidak mengakses atau mengubah data. | Rendah — ditunda |
| B2 | Token dengan format/tanda tangan tidak valid | LULUS untuk pengujian lokal yang dilakukan | Rute catatan lokal membalas 401 untuk token rusak atau tanda tangan salah. Token kedaluwarsa yang ditandatangani valid belum diuji dinamis. | Rendah |
| B3 | Token mengarah ke pengguna yang tidak ada | GAGAL lalu DITUNDA ke Task 5.6 | Middleware tidak memeriksa keberadaan pengguna; `/auth/me` membalas 404. | Rendah — ditunda |
| B4 | Hash dan paparan password | LULUS | Pendaftaran memakai bcrypt dengan cost 10; respons register, login, dan `/auth/me` tidak menyertakan hash/password. | Rendah |
| B5 | Kesetaraan jalur login | GAGAL lalu DIPERBAIKI | Uji router lokal terisolasi mendapat 401 dan pesan sama untuk email tidak ada/password salah; `bcrypt.compare` berjalan sekali pada tiap jalur. Benchmark waktu tidak dilakukan. | Sedang — ditangani |
| B6 | Batas input password untuk bcrypt | GAGAL lalu DIPERBAIKI | Uji router lokal: 72 byte diterima (register 201; login 401 untuk password uji yang salah), sedangkan 75 byte ditolak 422 pada register dan login. Database tidak disentuh. | Sedang — ditangani |
| B7 | Pembatas login | LULUS melalui inspeksi kode; belum diuji ambang 429 | Middleware memakai 10 percobaan per 15 menit dan melewati permintaan sukses. | Rendah |
| B8 | Logout dan penyimpanan token | LULUS sebagai keputusan MVP yang diterima | Logout hanya menghapus token lokal; JWT berlaku sampai kedaluwarsa. Risiko XSS/localStorage dicatat untuk pengujian tampilan. | Rendah — diterima |

## Kelompok C — Kepemilikan data dan injeksi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| C1 | Kepemilikan catatan dan mass assignment | LULUS untuk rute catatan yang diuji | Uji dua akun sintetis: B mendapat 404 saat GET/PATCH/DELETE catatan A dan saat merge lintas pemilik; daftar/tag B tidak memuat data A. PATCH pemilik mengabaikan field `userId`, `id`, `createdAt`, dan `embedding`; catatan A tetap utuh. Data uji dibersihkan. Mass assignment pada POST diperiksa secara statis. | Rendah |
| C2 | Kepemilikan ringkasan, konsep, percakapan AI, relasi, graph, dashboard, dan pencarian | LULUS sebagian | Uji dinamis graph, dashboard, daftar/detail/hapus percakapan, `/ai/ask`, ringkasan, ekstraksi konsep, dan merge-preview menolak ID lintas pemilik; jalur AI ditolak sebelum layanan AI dipanggil. Rute konsep/relasi/pencarian lain diperiksa statis. | Rendah |
| C3 | SQL injection dan pengurutan | LULUS untuk area yang diuji | Query raw yang diperiksa memakai tagged template; tidak ditemukan `queryRawUnsafe`/`executeRawUnsafe`; sort memakai whitelist. Tanda kutip/titik koma diuji sebagai data judul, isi, dan tag; sort/page/limit/ID tidak valid ditolak. Tidak ada SQL destruktif yang dijalankan. Pencarian semantik tidak diuji dinamis karena dapat memanggil layanan embedding eksternal. | Rendah |
| C4 | UUID dan validasi input | LULUS sebagian; batas halaman/tag diperbaiki | ID rute memakai validasi UUID. Halaman kini dibatasi 10.000 dan tag filter 30 karakter; uji router lokal mendapat 422 untuk 10.001 dan 31 karakter tanpa query database. | Rendah — ditangani |
| C5 | Uji dinamis IDOR dan injeksi | LULUS SEBAGIAN | Uji dua akun lulus untuk operasi catatan, graph/dashboard, percakapan, daftar/tag, merge, serta endpoint AI yang menolak sebelum panggilan AI. Tanda baca aman dan validasi parameter diuji; akun, catatan, serta percakapan sintetis dibersihkan. Pencarian semantik, mass assignment POST, dan sebagian rute konsep/relasi belum diuji dinamis. | Rendah — cakupan tersisa |

Pemeriksaan Kelompok D–F belum dilakukan.
