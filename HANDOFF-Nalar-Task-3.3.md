# HANDOFF NALAR: Task 3.3 (Validasi dan pagination)

Diperbarui: 11 Nov 2026 (Hari 7 dari 30). Sprint 3 berjalan. Task 3.1 (backend catatan) dan 3.2 (frontend catatan + tag) sudah dikerjakan AI lain dan di-commit pemilik.

## Cara memakai file ini
Tempel seluruh isi file ini ke AI baru di awal percakapan, lalu tulis: "Kerjakan Task 3.3 sesuai bagian 'Tugas untukmu'."

## Instruksi untuk AI yang menerima
Pemilik proyek adalah pelajar pemula web development di Indonesia, memakai Windows 11, VS Code (terminal Git Bash), Git, dan GitHub. Aturan berkomunikasi:
- Pakai bahasa Indonesia sehari-hari yang mudah, hindari bahasa akademis.
- Beri langkah satu per satu, sebut dengan jelas nama file dan lokasinya (contoh: `backend/src/routes/notes.ts`). Beri isi file lengkap kalau membuat file baru. Kalau mengubah file yang sudah ada, JANGAN menebak isinya: minta pemilik menempel isi file aslinya dulu, lalu beri versi lengkap yang sudah diubah.
- Perintah dijalankan di terminal VS Code. Sebut folder mana (`backend` atau `frontend`).
- Jangan pernah meminta pemilik menempel isi `.env` atau `.env.local` (rahasia). Kalau perlu, minta nama variabelnya saja.
- Kalau ada error, minta pesan error apa adanya.
- Perintah Git dijalankan dari FOLDER UTAMA proyek (`Nalar-web-app`), bukan dari `backend` atau `frontend`. Ingatkan pemilik menjalankan `git status` sebelum `git add .`.
- Sebelum batas pemakaianmu habis, perbarui catatan serah terima ini (status dan langkah berikutnya) supaya bisa dilanjutkan AI lain.

## Tentang Nalar
Aplikasi web manajemen pengetahuan pribadi berbasis AI. Pengguna menulis catatan, AI meringkas dan mengambil konsep, catatan dicari berdasarkan makna, dihubungkan dalam knowledge graph, dan ditanyai lewat AI Assistant. Target selesai 30 hari (5 Nov - 4 Des 2026), untuk portofolio. Tagline: "Hubungkan Idemu. Temukan Pengetahuanmu."

## Stack dan versi
- Frontend: Next.js (App Router, folder `src/`), TypeScript, Tailwind
- Backend: Express + TypeScript (`tsx watch`, `npm run dev`), REST di `/api/v1`
- Database: Neon PostgreSQL + pgvector, ORM Prisma versi 6 (dipin ke 6 dengan sengaja)
- Auth: JWT 1 hari, token di `localStorage`
- Validasi backend: Zod
- Port: backend 4000, frontend 3000
- Repo GitHub: Public (permintaan mentor, bukan masalah). Folder utama lokal: `Nalar-web-app` berisi `backend` dan `frontend`. File catatan serah terima `HANDOFF-*.md` berada di folder utama.

## Aturan dan keputusan (jangan dibalik tanpa alasan kuat)
- Kepemilikan data dijaga di backend: `userId` SELALU dari token (`req.userId`), TIDAK PERNAH dari body, query, atau parameter. Semua query catatan wajib difilter `userId`.
- Tidak ada lapisan `repositories/`. Route memanggil Prisma langsung.
- Format response seragam. Berhasil: `{ "success": true, "message": "...", "data": {} }`. Gagal: `{ "success": false, "message": "...", "errors": [{ "field": "...", "message": "..." }] }`. Status: 200, 201, 401, 404, 422, 500. Penghapusan membalas 200 dengan JSON (bukan 204), karena `apiFetch` di frontend memanggil `res.json()`.
- Gaya handler: `res.status(...).json(...); return;` (jangan `return res.json(...)`).
- Semua teks tampilan dan pesan error memakai bahasa Indonesia.
- Gaya visual sementara (palet final belum diputuskan): latar `bg-slate-50`, kartu `bg-white rounded-2xl ring-1 ring-slate-200`, tombol utama `bg-indigo-600 hover:bg-indigo-700 text-white`, input `rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200`. Selalu beri warna teks eksplisit karena `globals.css` bawaan Next.js berubah di mode gelap sistem. Target sentuh minimal 44px, tampilan harus rapi di HP.
- Jangan menambah fitur di luar task ini (tidak ada AI, embedding, semantic search).

## Kode yang sudah ada (gaya penulisan)
Backend memiliki: `src/index.ts`, `src/lib/prisma.ts`, `src/lib/jwt.ts`, `src/middleware/auth.ts` (`requireAuth`, mengisi `req.userId`), `src/routes/auth.ts`, `src/routes/notes.ts` (Task 3.1 dan tag dari 3.2), `src/types/express.d.ts`.
Frontend memiliki: `src/lib/api.ts` (`apiFetch`, `pesanError`, `ApiResult`; di Task 3.2 `status` mungkin sudah ditambahkan), `src/lib/auth.ts` (`getToken`, `saveToken`, `clearToken`), `src/lib/useRequireAuth.ts`, `src/components/AppShell.tsx`, `NoteEditor.tsx`, `ConfirmDialog.tsx`, dan halaman `src/app/notes/page.tsx`, `notes/new/page.tsx`, `notes/[id]/page.tsx`, `login`, `register`, `dashboard`.
Bentuk persisnya dikerjakan AI lain, jadi SEBELUM menulis kode minta pemilik menempel isi: `backend/src/routes/notes.ts`, `backend/src/index.ts`, `backend/prisma/schema.prisma` (hanya model Note), `frontend/src/lib/api.ts`, dan `frontend/src/app/notes/page.tsx`.

## Model Note (dengan tag dari Task 3.2)
Kolom: `id, userId, title, content, summary?, tags String[] (default []), createdAt, updatedAt`. Pemetaan nama tabel dan kolom: tabel `notes`, kolom `user_id`, `updated_at`, dan seterusnya (`@map`).

## Kontrak API catatan saat ini
Semua butuh header `Authorization: Bearer <token>`. Alamat dasar `http://localhost:4000/api/v1`.
- `POST /notes` (201): body `{ title, content, tags? }`.
- `GET /notes`: saat ini mengembalikan semua catatan milik pengguna dalam `data: { items: [{ id, title, summary, contentPreview, tags, createdAt, updatedAt }] }`, terbaru dulu.
- `GET /notes/:id`: detail lengkap.
- `PATCH /notes/:id`: ubah sebagian. `DELETE /notes/:id`: hapus (200 JSON).
- Id bukan UUID atau catatan milik orang lain: 404 "Catatan tidak ditemukan".

## Status
- Sprint 1 dan 2 selesai. Task 3.1 dan 3.2 sudah dikerjakan dan di-commit pemilik (tes manualnya dilakukan pemilik; konfirmasikan dengan pemilik bahwa halaman `/notes` berjalan sebelum mulai).
- Belum ada pagination, pencarian, atau filter. `GET /notes` mengembalikan semua catatan.
- Belum ada sidebar. `AppShell.tsx` adalah header sementara (diganti di Task 3.4).

## TUGAS UNTUKMU: Task 3.3 Validasi dan pagination (Hari 10, 9 SP)
Epic [NOTE], prioritas Sedang, label Backend dan Frontend.

Subtask dan poin:
1. Validasi judul dan isi catatan dengan Zod (2 pts)
2. Pagination di backend (`page` dan `limit`) (2 pts)
3. Pagination di tampilan (2 pts)
4. Filter tag dan urutan terbaru (2 pts)
5. Tampilan loading dan tampilan kosong (1 pt)

Dokumen API juga menyebut parameter `search`. Masukkan pencarian kata kunci sederhana (cocokkan judul atau isi, tanpa membedakan huruf besar kecil) sebagai bagian subtask 4. Ini BUKAN semantic search (itu Sprint 4).

### Backend (`backend/src/routes/notes.ts`, dan `index.ts` untuk batas ukuran)
1. Perketat validasi Zod (pesan bahasa Indonesia):
   - `title`: di-trim, 1 sampai 255 karakter, tidak boleh hanya spasi.
   - `content`: di-trim, minimal 1, maksimal 50.000 karakter (melindungi biaya AI nanti).
   - `tags`: sudah ada dari 3.2 (maksimal 10, tiap tag 1 sampai 30 karakter, huruf kecil, tanpa duplikat). Pastikan aturannya konsisten di create dan update.
   - Di `index.ts`, ubah `express.json()` menjadi `express.json({ limit: "1mb" })`.
2. `GET /notes` menerima query (divalidasi dengan Zod, memakai `z.coerce.number()` untuk angka):
   - `page` (bilangan bulat, minimal 1, default 1)
   - `limit` (bilangan bulat 1 sampai 50, default 10)
   - `search` (opsional, di-trim, maksimal 100 karakter)
   - `tag` (opsional, satu tag, huruf kecil)
   - `sort`: `terbaru` (default, `updatedAt` turun), `terlama` (`updatedAt` naik), `judul` (`title` naik)
   - Nilai tidak valid membalas 422 dengan format error biasa (jangan di-clamp diam-diam).
3. Query: `where = { userId, ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }] } : {}), ...(tag ? { tags: { has: tag } } : {}) }`. Jalankan `count` dan `findMany` (dengan `skip: (page-1)*limit`, `take: limit`) dalam satu `prisma.$transaction([...])`. Respons:
   ```json
   { "success": true, "message": "Berhasil", "data": {
       "items": [ ... bentuk item sama seperti sebelumnya ... ],
       "pagination": { "page": 1, "limit": 10, "total": 37, "totalPages": 4 } } }
   ```
   `totalPages = Math.ceil(total / limit)`. Halaman di luar jangkauan (misal `page=99`) tetap 200 dengan `items: []` dan angka `total` yang benar.
4. Endpoint baru `GET /notes/tags` (WAJIB didaftarkan SEBELUM route `/:id`, kalau tidak "tags" dianggap id). Mengembalikan tag milik pengguna beserta jumlahnya untuk daftar filter:
   ```ts
   const rows = await prisma.$queryRaw<{ tag: string; count: number }[]>`
     SELECT t AS tag, COUNT(*)::int AS count
     FROM notes, UNNEST(tags) AS t
     WHERE user_id = ${userId}::uuid
     GROUP BY t
     ORDER BY count DESC, t ASC`;
   ```
   Balas `data: { tags: rows }`. Pakai `COUNT(*)::int` (tanpa itu hasilnya BigInt dan gagal diubah ke JSON). Pakai tagged template (`$queryRaw` dengan backtick) agar parameter aman dari SQL injection, JANGAN menyusun string SQL sendiri.
5. Skrip contoh data supaya pemilik tidak membuat 25 catatan manual: `backend/scripts/seed-notes.ts`. Dijalankan `npx tsx scripts/seed-notes.ts email@pemilik.com` (membuat 25 catatan berjudul "[Contoh] ..." dengan isi beragam dan tag campuran seperti javascript, css, database, ide untuk pengguna dengan email itu), dan `npx tsx scripts/seed-notes.ts email@pemilik.com --hapus` (menghapus hanya catatan yang judulnya diawali "[Contoh]" milik email itu). Skrip menolak jalan kalau email tidak ditemukan. Pasang `import "dotenv/config"`.

### Frontend (`frontend/src/app/notes/page.tsx` dan komponen baru)
1. Keadaan filter disimpan di alamat URL, misalnya `/notes?page=2&tag=javascript&sort=terbaru&search=react`. Pakai `useSearchParams` dan `useRouter` dari `next/navigation`. PENTING: komponen yang memakai `useSearchParams` harus dibungkus `<Suspense>` di halaman, kalau tidak `npm run build` gagal. Pisahkan isi daftar jadi komponen (misal `NotesList`) dan bungkus di `page.tsx` dengan `<Suspense fallback={...}>`. Refresh halaman harus mempertahankan filter dan halaman.
2. Kontrol di atas daftar: kotak cari ("Cari judul atau isi...", tunda kirim 400 ms setelah berhenti mengetik), pilihan urutan ("Terbaru", "Terlama", "Judul A-Z"), dan deretan chip tag dari `GET /notes/tags` (chip "Semua" plus tiap tag dengan jumlahnya, klik untuk memilih atau melepas, chip aktif berwarna indigo). Setiap perubahan filter mengembalikan `page` ke 1.
3. Pagination: komponen `src/components/Pagination.tsx` dengan tombol "Sebelumnya" dan "Berikutnya", teks "Halaman 2 dari 4", dan keterangan "Menampilkan 11-20 dari 37 catatan". Tombol dinonaktifkan di batas. Sembunyikan kalau `totalPages <= 1`.
4. Loading: saat pertama memuat, tampilkan 3 kartu kerangka abu-abu berdenyut (`animate-pulse`), bukan teks. Saat berganti halaman atau filter, daftar lama dibuat agak pudar (`opacity-60`) sampai data baru datang.
5. Keadaan kosong ada dua jenis: (a) pengguna belum punya catatan sama sekali: pesan ajakan dan tombol "+ Catatan Baru" (sudah ada dari 3.2, rapikan), (b) filter tidak menghasilkan apa pun: "Tidak ada catatan yang cocok dengan filter ini." dengan tombol "Hapus filter". Keadaan error punya tombol "Coba lagi".
6. Cegah balapan permintaan: kalau pengguna cepat mengganti filter, abaikan respons lama (pakai penghitung permintaan di `useRef`; `apiFetch` belum mendukung `AbortController`).
7. Setelah menghapus catatan: muat ulang daftar dari server. Kalau yang dihapus adalah satu-satunya catatan di halaman yang bukan halaman 1, pindah ke halaman sebelumnya.
8. Validasi di formulir editor mengikuti backend: `maxLength` 255 di judul, penghitung karakter di isi ("1.250 / 50.000"), tampilkan pesan error dari backend (`pesanError`).

### Cara tes
Backend (Thunder Client, header Bearer token). Jalankan seed dulu untuk akun pemilik.
1. `GET /notes` menghasilkan 10 item dan `pagination` `{ page:1, limit:10, total:25, totalPages:3 }`.
2. `GET /notes?page=3` menghasilkan 5 item. `?page=99` menghasilkan 200 dengan `items: []`. `?page=0`, `?limit=500`, `?sort=acak` menghasilkan 422.
3. `GET /notes?search=react` hanya mengembalikan yang cocok (tanpa membedakan huruf besar kecil). `?tag=javascript` hanya yang bertag itu. `?sort=judul` terurut A-Z. Kombinasi `?tag=css&search=flex&sort=terlama&page=1&limit=5` bekerja.
4. `GET /notes/tags` mengembalikan daftar tag dengan jumlah yang benar.
5. `POST /notes` dengan judul berisi spasi saja menghasilkan 422. Isi 50.001 karakter menghasilkan 422.
6. Isolasi data: akun kedua memanggil `GET /notes` dan `/notes/tags`, hasilnya hanya miliknya (kosong untuk akun baru).
Frontend (browser):
7. Buka `/notes`: 10 kartu dan pagination. Klik "Berikutnya" lalu refresh, tetap di halaman yang sama.
8. Klik chip tag, ketik di kotak cari, ganti urutan: daftar dan URL ikut berubah, halaman kembali ke 1.
9. Cari kata yang tidak ada: muncul "Tidak ada catatan yang cocok..." dan tombol "Hapus filter" berfungsi.
10. Hapus satu catatan di halaman terakhir yang hanya berisi satu catatan: pindah ke halaman sebelumnya.
11. Matikan backend lalu muat ulang: muncul pesan error dengan tombol "Coba lagi".
12. Tampilan HP (Chrome F12, mode perangkat): kontrol filter dan pagination rapi, tidak ada geser samping.
13. `npm run build` di folder `frontend` berhasil tanpa error (membuktikan `Suspense` benar). `npm run lint` bersih.
14. Bersihkan data contoh dengan `--hapus`.

### Selesai (Definition of Done)
Semua tes lulus, tidak ada error merah di terminal backend dan frontend, kode di-commit dari FOLDER UTAMA dengan pesan "validasi dan pagination catatan" dan di-push ke GitHub, lalu pemilik mencentang kelima subtask Task 3.3 dan mengubah statusnya jadi Selesai di aplikasi tugasnya.

## Setelah Task 3.3
- 3.4 Dashboard frontend (endpoint `GET /dashboard/stats`, kartu statistik jumlah catatan, konsep, relasi, daftar catatan terbaru, sidebar menggantikan `AppShell`)
- 3.5 Integrasi OpenAI, 3.6 AI Summary, 3.7 Concept Extraction. Catatan: dokumen API menulis endpoint ringkasan `POST /ai/summarize` dengan body `{ "noteId": "uuid" }` (rencana task menulis `POST /notes/:id/summary`, pakai dokumen API).
Rincian lengkap subtask dan poin ada di dokumen rencana: https://claude.ai/artifact/BApWPz7emUD27NWxHWAcQn
Catatan untuk nanti (Task 5.7): kolom `tags` dan pencarian teks bisa diberi index agar cepat.

## Aset lain
- Desain UI/UX 7 halaman (masih berbahasa Inggris; ikuti tata letaknya tapi teks bahasa Indonesia): https://claude.ai/artifact/XshdsHMNApnETbdwYJykox
- Logo dan ikon final ada di `nalar-brand.zip` milik pemilik. `logo-symbol.svg` sudah ada di `frontend/public`.
- Dokumen proyek (PRD, Technical Design, Database Schema SQL, Neon Setup, API Specification, Roadmap) dimiliki pemilik sebagai file terpisah.
