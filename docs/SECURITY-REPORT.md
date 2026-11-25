# Laporan Keamanan Nalar

Pemeriksaan dilakukan bertahap pada aplikasi lokal. Laporan ini tidak memuat nilai env, key, token, email asli, atau data pribadi.

## Kelompok A — Rahasia dan konfigurasi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| A1 | `.env` diabaikan Git dan file env ter-track | LULUS | Hanya file contoh yang ter-track; file env lokal diabaikan. | Rendah |
| A2 | Riwayat Git untuk pola secret | LULUS | Pencarian pola yang ditentukan tidak menemukan kandidat secret nyata; temuan berasal dari placeholder file contoh. | Rendah |
| A3 | Kekuatan `JWT_SECRET` | LULUS setelah perbaikan | Saat startup, produksi berhenti jika secret kosong atau kurang dari 32 karakter; development memberi peringatan tanpa mencetak nilainya. Pemeriksaan langsung juga menolak secret pendek di produksi. | Sedang — ditangani |
| A4 | Variabel `NEXT_PUBLIC_*` | LULUS | Kode frontend hanya membaca `NEXT_PUBLIC_API_URL`, yaitu URL API publik. Nilainya tidak diperiksa atau ditampilkan. | Rendah |
| A5 | `npm audit` | GAGAL lalu DITUNDA ke Task 5.6 | Audit melaporkan 3 temuan berlabel High di rantai Prisma/deepmerge-ts dan 7 Moderate di rantai minimatch. Peninjauan menggolongkan dampaknya sebagai risiko DoS berisiko rendah; tidak ada `npm audit fix --force` dan tidak ada pembaruan dependensi pada kelompok ini. Prisma tetap versi 6. | Rendah — diterima sementara |
| A6 | Endpoint health publik | LULUS | Health check hanya memberi status umum dan tidak mengembalikan host, nama database, atau versi. | Rendah |

## Kelompok B — Autentikasi dan sesi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| B1 | Rute dan middleware autentikasi | LULUS untuk rute data; logout no-op publik ditunda ke Task 5.6 | Rute data memakai `requireAuth`; `POST /auth/logout` tanpa token memberi 200, tetapi tidak mengakses atau mengubah data. | Rendah — ditunda |
| B2 | Token dengan format/tanda tangan tidak valid | LULUS untuk pengujian lokal yang dilakukan | Rute catatan lokal membalas 401 untuk token rusak atau tanda tangan salah. Token kedaluwarsa yang ditandatangani valid belum diuji dinamis. | Rendah |
| B3 | Token mengarah ke pengguna yang tidak ada | GAGAL lalu DITUNDA ke Task 5.6 | Middleware tidak memeriksa keberadaan pengguna; `/auth/me` membalas 404. | Rendah — ditunda |
| B4 | Hash dan paparan password | LULUS | Pendaftaran dan ubah password memakai bcrypt dengan cost 10; respons register, login, `/auth/me`, dan `PATCH /auth/password` tidak menyertakan hash/password. | Rendah |
| B5 | Kesetaraan jalur login | GAGAL lalu DIPERBAIKI | Uji router lokal terisolasi mendapat 401 dan pesan sama untuk email tidak ada/password salah; `bcrypt.compare` berjalan sekali pada tiap jalur. Benchmark waktu tidak dilakukan. | Sedang — ditangani |
| B6 | Batas input password untuk bcrypt | GAGAL lalu DIPERBAIKI | Uji router lokal: 72 byte diterima (register 201; login 401 untuk password uji yang salah), sedangkan 75 byte ditolak 422 pada register dan login. Database tidak disentuh. | Sedang — ditangani |
| B7 | Pembatas login | LULUS melalui inspeksi kode; belum diuji ambang 429 | Middleware memakai 10 percobaan per 15 menit dan melewati permintaan sukses. | Rendah |
| B8 | Logout dan penyimpanan token | LULUS sebagai keputusan MVP yang diterima | Logout hanya menghapus token lokal; JWT berlaku sampai kedaluwarsa. Risiko XSS/localStorage dicatat untuk pengujian tampilan. | Rendah — diterima |
| B9 | Endpoint ubah password (`PATCH /api/v1/auth/password`) | LULUS | Memakai `requireAuth` dan `batasAuth` (10 percobaan/15 menit untuk percobaan gagal); validasi Zod (panjang, 72 byte, password baru beda); password lama salah membalas 400 (bukan 401); update hanya untuk `req.userId`; tidak pernah membocorkan password/hash. | Rendah |

## Kelompok C — Kepemilikan data dan injeksi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| C1 | Kepemilikan catatan dan mass assignment | LULUS untuk rute catatan yang diuji | Uji dua akun sintetis: B mendapat 404 saat GET/PATCH/DELETE catatan A dan saat merge lintas pemilik; daftar/tag B tidak memuat data A. PATCH pemilik mengabaikan field `userId`, `id`, `createdAt`, dan `embedding`; catatan A tetap utuh. Data uji dibersihkan. Mass assignment pada POST diperiksa secara statis. | Rendah |
| C2 | Kepemilikan ringkasan, konsep, percakapan AI, relasi, graph, dashboard, dan pencarian | LULUS sebagian | Uji dinamis graph, dashboard, daftar/detail/hapus percakapan, `/ai/ask`, ringkasan, ekstraksi konsep, dan merge-preview menolak ID lintas pemilik; jalur AI ditolak sebelum layanan AI dipanggil. Rute konsep/relasi/pencarian lain diperiksa statis. | Rendah |
| C3 | SQL injection dan pengurutan | LULUS untuk area yang diuji | Query raw yang diperiksa memakai tagged template; tidak ditemukan API raw tanpa parameter; sort memakai whitelist. Tanda kutip/titik koma diuji sebagai data judul, isi, dan tag; sort/page/limit/ID tidak valid ditolak. Tidak ada SQL destruktif yang dijalankan. Pencarian semantik tidak diuji dinamis karena dapat memanggil layanan embedding eksternal. | Rendah |
| C4 | UUID dan validasi input | LULUS sebagian; batas halaman/tag diperbaiki | ID rute memakai validasi UUID. Halaman kini dibatasi 10.000 dan tag filter 30 karakter; uji router lokal mendapat 422 untuk 10.001 dan 31 karakter tanpa query database. | Rendah — ditangani |
| C5 | Uji dinamis IDOR dan injeksi | LULUS SEBAGIAN | Uji dua akun lulus untuk operasi catatan, graph/dashboard, percakapan, daftar/tag, merge, serta endpoint AI yang menolak sebelum panggilan AI. Tanda baca aman dan validasi parameter diuji; akun, catatan, serta percakapan sintetis dibersihkan. Pencarian semantik, mass assignment POST, dan sebagian rute konsep/relasi belum diuji dinamis. | Rendah — cakupan tersisa |

## Kelompok D — XSS dan keamanan tampilan

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| D1 | API render HTML/JavaScript dan parser Markdown | LULUS | Pemindaian frontend tidak menemukan `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, atau dependensi parser Markdown. Data catatan dan AI dirender sebagai teks JSX; label graph digambar di kanvas. | Rendah |
| D2 | Payload XSS di daftar, detail, editor, pencarian, graph, dashboard, asisten, dan gabung | LULUS dengan batas cakupan | Pemilik menguji di browser dan melaporkan semua tampilan aman tanpa `alert`. Judul, isi, dan tag berpayload tersimpan dan tampil sebagai teks. Ekstraksi konsep juga tampil aman, tetapi AI tidak mengeluarkan nama konsep yang persis berisi payload; nilai payload itu tidak dapat diuji langsung pada chip konsep. Catatan uji dibersihkan. | Rendah |
| D3 | Tautan dari teks catatan/AI dan `javascript:` | LULUS / tidak ada tautan otomatis | Teks catatan tidak diubah menjadi tautan dan tidak ada renderer Markdown. Sumber asisten memakai tautan internal berdasarkan ID catatan, bukan URL dari teks. Payload `javascript:` tampil sebagai teks biasa. | Rendah |

## Kelompok E — Header, CORS, dan mode produksi

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| E1 | Header backend dan HSTS | LULUS melalui inspeksi dan konfigurasi | Memakai Helmet 8.3.0 yang sudah menjadi dependensi; dokumentasi resminya diperiksa. Helmet memasang header keamanan, `X-Powered-By` dinonaktifkan, dan HSTS hanya aktif pada `NODE_ENV=production`. | Rendah |
| E2 | Header frontend Next.js | LULUS melalui konfigurasi | `headers()` untuk semua halaman menambahkan `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, serta `Permissions-Policy` untuk kamera, mikrofon, dan lokasi. CSP sengaja tidak ditambahkan agar tidak merusak skrip Next.js. | Rendah |
| E3 | CORS | LULUS | Produksi hanya memakai `FRONTEND_URL`; jika variabel tidak ada, origin tidak diizinkan. Development tetap memakai localhost sebagai fallback. Callback CORS membandingkan origin secara tepat. Skrip lokal dan pemeriksaan header dengan `Origin: http://evil.example` memastikan tidak ada `Access-Control-Allow-Origin`. | Rendah |
| E4 | Batas ukuran body dan teks AI/pencarian | LULUS melalui inspeksi kode | JSON dibatasi 1 MB; pertanyaan asisten 1.000 karakter; pencarian 200 karakter; daftar catatan dan tag juga divalidasi dengan batas. | Rendah |
| E5 | Error produksi | LULUS melalui inspeksi kode; mode produksi tidak dijalankan langsung | JSON rusak dipetakan ke 400, payload besar ke 413, masalah koneksi DB ke 503 umum, dan error 500 tidak mengirim pesan internal/stack saat produksi. Skrip lokal mendapat 400 untuk JSON rusak dan respons bersih untuk UUID tidak valid. | Rendah |
| E6 | Log server | LULUS melalui inspeksi | Log error tidak lagi mencetak objek error atau pesannya; hanya nama error/status dan metadata operasional. Log AI tidak mencetak isi prompt atau API key. | Rendah |

## Kelompok F — Keamanan khusus AI

| # | Pemeriksaan | Hasil | Bukti singkat | Risiko |
|---|---|---|---|---|
| F1 | Injeksi prompt pada ringkasan, konsep, asisten, dan gabung | GAGAL lalu DIPERBAIKI, uji manual lulus | Ringkasan/konsep sebelumnya belum menetralkan tag `<catatan>` dari data. Ditambahkan `netralkanPenandaCatatan` dan dipakai juga untuk judul/isi pada keempat jalur. Pemilik mencoba injeksi lewat ringkasan, konsep, asisten, dan gabung; melaporkan hasil aman, bukan hanya `HAHA` dan tanpa kebocoran instruksi sistem. | Sedang — ditangani |
| F2 | Kepemilikan konteks asisten dan jawaban tanpa konteks | LULUS melalui inspeksi | Pencarian konteks dan query catatan sama-sama memfilter `userId`; jika konteks kosong, jawaban fallback digunakan tanpa memanggil generator jawaban. | Rendah |
| F3 | Validasi output AI | LULUS melalui inspeksi | Parser konsep membatasi hingga 8 konsep, nama 150 karakter, deskripsi 300 karakter. Hasil gabung dibatasi judul 100 dan isi 50.000 karakter. Output ditampilkan sebagai teks; tidak dieksekusi. | Rendah |
| F4 | Pembatas pemakaian AI | LULUS melalui inspeksi kode | Endpoint AI memakai pembatas per pengguna: 8 per menit dan 60 per hari secara bawaan; validasi kepemilikan/input dilakukan sebelum pemanggilan model. Ambang 429 tidak dipicu dalam uji ini. | Rendah |
| F5 | Peringatan privasi AI | LULUS | Halaman Asisten kini memperingatkan bahwa catatan yang dikirim ke AI diproses oleh penyedia AI dan menyarankan menghindari informasi sensitif. | Rendah |

## Validasi akhir

| Pemeriksaan | Hasil | Bukti |
|---|---|---|
| `npx tsx scripts/tes-keamanan.ts` dari folder backend | LULUS | 23/23 pemeriksaan lulus; dua akun uji dan seluruh data terkait dibersihkan. Skrip memakai fixture Prisma dan validasi yang berhenti sebelum model, jadi tidak memanggil layanan AI. |
| `npx tsc --noEmit` dari folder backend | LULUS | Type-check selesai tanpa error. |
| `npm run lint` dari folder frontend | LULUS | ESLint selesai tanpa temuan. |
| `npm run build` dari folder frontend | LULUS | Build Next.js dan pemeriksaan TypeScript selesai. |
