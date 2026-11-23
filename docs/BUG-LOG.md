# Catatan Bug Nalar (BUG-LOG)

Dokumen ini mencatat bug, kendala, atau hal yang tidak semestinya ditemukan selama pengujian integrasi (Task 5.1).
*Catatan keamanan: Dokumen ini tidak boleh memuat API key, password, email asli, token, atau data rahasia/pribadi.*

---

## Ringkasan Bug

| Tingkat | Terbuka | Diperbaiki | Dipindah ke Task Lain | Total |
| :--- | :---: | :---: | :---: | :---: |
| **P1** (Kritis / Bocor Data / Rusak Total) | 0 | 1 | 0 | 1 |
| **P2** (Fitur Bermasalah / Membingungkan)   | 0 | 7 | 0 | 7 |
| **P3** (Kosmetik / Tampilan / Bahasa)       | 0 | 5 | 2 | 7 |
| **Total**                                   | **0** | **13** | **2** | **15** |

---

## Daftar Bug

### B-01 Pengiriman Pertanyaan Asisten AI Gagal Karena Body Ter-serialize Ganda
- **Tingkat**: P1
- **Langkah Mengulang**:
  1. Buka halaman `/assistant`.
  2. Ketik pertanyaan lalu kirim.
- **Hasil yang Diharapkan**: Request dikirim ke `/api/v1/ai/ask` dengan payload JSON valid dan asisten menjawab.
- **Hasil yang Terjadi**: Request gagal status 400. Backend mencatat `SyntaxError` dari body-parser karena body di-stringified dua kali (`"{\"conversationId\":null,...}"`).
- **Dugaan File Penyebab**: `frontend/src/components/assistant/AssistantContent.tsx`
- **Status**: Diperbaiki di 5.1 (objek dilempar langsung ke `apiFetch`, tidak perlu `JSON.stringify` manual).
- **Task Terkait**: Task 5.1 / Task 4.6

### B-02 Pesan Error 400 SyntaxError Ditampilkan Sebagai "Tidak bisa terhubung ke server"
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Kirim payload JSON yang tidak valid ke backend.
- **Hasil yang Diharapkan**: Backend membalas JSON `{ success: false, message: "Format permintaan tidak valid." }` dan antarmuka menampilkan pesan tersebut.
- **Hasil yang Terjadi**: Express standar membalas halaman HTML 400 bawaan, sehingga `res.json()` di frontend gagal/catch dan memunculkan "Tidak bisa terhubung ke server. Pastikan backend sedang menyala".
- **Dugaan File Penyebab**: `backend/src/index.ts`
- **Status**: Diperbaiki di 5.1 (menambahkan error handler khusus `SyntaxError` body-parser yang mengembalikan format JSON standar).
- **Task Terkait**: Task 5.1 / Task 5.2

### B-03 Form Catatan Baru (`/notes/new`) Masih Menyimpan Data Form Sebelumnya
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Buka `/notes/new`, isi dan simpan catatan.
  2. Buka kembali `/notes/new`.
- **Hasil yang Diharapkan**: Form `/notes/new` selalu bersih/kosong.
- **Hasil yang Terjadi**: State form masih mempertahankan teks judul/isi sebelumnya jika komponen tidak ter-unmount sempurna saat navigasi.
- **Dugaan File Penyebab**: `frontend/src/components/NoteEditor.tsx`, `frontend/src/app/notes/new/page.tsx`
- **Status**: Diperbaiki di 5.1 (reset state lokal setelah submit berhasil dan pemberian `key="new-note"` pada instance NoteEditor).
- **Task Terkait**: Task 5.1

### B-04 Daftar Catatan Belum Memiliki Halaman Baca dan Aksi Kartu yang Ringkas
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Buka halaman `/notes`.
  2. Coba membuka catatan dengan mengeklik bagian kartu selain tombol tindakan.
- **Hasil yang Diharapkan**: Seluruh kartu dapat dibuka ke halaman baca, dan aksi ubah, gabung, serta hapus tersedia dari menu titik tiga.
- **Hasil yang Terjadi**: Kartu menampilkan checkbox, tombol ubah, dan tombol hapus terus-menerus; halaman `/notes/[id]` langsung membuka editor.
- **Status**: Diperbaiki pada perubahan daftar catatan modern.
- **Task Terkait**: Task antarmuka daftar catatan

### B-05 Server Produksi Tidak Memvalidasi Panjang JWT Secret Saat Startup
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Jalankan backend dengan `NODE_ENV=production` dan `JWT_SECRET` kosong atau kurang dari 32 karakter.
- **Hasil yang Diharapkan**: Server menolak untuk berjalan tanpa mencetak nilai secret.
- **Hasil yang Terjadi**: Sebelumnya server dapat mulai tanpa pemeriksaan panjang secret saat startup.
- **Dugaan File Penyebab**: `backend/src/lib/jwt.ts`, `backend/src/index.ts`
- **Status**: Diperbaiki di Task 5.3 (startup produksi berhenti jika secret tidak valid; development memberi peringatan tanpa nilai secret).
- **Task Terkait**: Task 5.3

### B-06 Temuan Audit Dependensi DoS Ditunda untuk Tinjauan Kompatibilitas
- **Tingkat**: P3
- **Langkah Mengulang**:
  1. Jalankan `npm audit` dari folder backend dan frontend.
- **Hasil yang Diharapkan**: Tidak ada temuan dependensi yang berisiko untuk aplikasi.
- **Hasil yang Terjadi**: Audit melaporkan 3 temuan High pada rantai Prisma/deepmerge-ts dan 7 Moderate pada rantai minimatch; peninjauan menggolongkannya sebagai risiko DoS berisiko rendah.
- **Dugaan File Penyebab**: Lockfile backend dan frontend.
- **Status**: Ditunda ke Task 5.6 untuk ditinjau dan diperbarui tanpa memaksa perubahan mayor.
- **Task Terkait**: Task 5.3 / Task 5.6

### B-07 Password Lebih dari 72 Byte Dapat Terpotong oleh bcrypt
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Kirim password yang panjangnya lebih dari 72 byte pada daftar atau login.
- **Hasil yang Diharapkan**: Password di luar batas ditolak sebelum diproses bcrypt.
- **Hasil yang Terjadi**: Sebelumnya daftar hanya membatasi jumlah karakter dan login tidak membatasi panjang; bcrypt memakai maksimal 72 byte pertama.
- **Dugaan File Penyebab**: `backend/src/routes/auth.ts`
- **Status**: Diperbaiki di Task 5.3 dengan validasi 72 byte UTF-8 untuk daftar dan login. Uji router terisolasi: 72 byte diterima dan 75 byte ditolak 422.
- **Task Terkait**: Task 5.3

### B-08 Perbedaan Jalur Login Membuka Risiko Enumerasi Waktu
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Bandingkan login email yang tidak terdaftar dengan email terdaftar yang memakai password salah.
- **Hasil yang Diharapkan**: Kedua jalur melakukan perbandingan hash dengan biaya yang setara.
- **Hasil yang Terjadi**: Sebelumnya jalur email yang tidak ada melewati `bcrypt.compare`.
- **Dugaan File Penyebab**: `backend/src/routes/auth.ts`
- **Status**: Diperbaiki di Task 5.3 dengan hash dummy berbiaya sama. Uji router terisolasi memastikan pesan/status sama dan `bcrypt.compare` berjalan pada kedua jalur; benchmark waktu belum dilakukan.
- **Task Terkait**: Task 5.3

### B-09 Token Pengguna yang Sudah Tidak Ada Mendapat 404
- **Tingkat**: P3
- **Langkah Mengulang**:
  1. Akses `/auth/me` memakai token bertanda tangan valid yang mengarah ke pengguna yang sudah dihapus.
- **Hasil yang Diharapkan**: Respons 401, sama dengan sesi tidak valid.
- **Hasil yang Terjadi**: Middleware menerima token; `/auth/me` mengembalikan 404 saat pengguna tidak ditemukan.
- **Dugaan File Penyebab**: `backend/src/middleware/auth.ts`, `backend/src/routes/auth.ts`
- **Status**: Diperbaiki di Task 5.4; `/auth/me` mengembalikan 401 dengan pesan sesi yang sama seperti token tidak valid.
- **Task Terkait**: Task 5.3 / Task 5.4

### B-10 Rute Logout Publik Hanya Memberi Respons Sukses
- **Tingkat**: P3
- **Langkah Mengulang**:
  1. Kirim `POST /auth/logout` tanpa token.
- **Hasil yang Diharapkan**: Rute data selain login, daftar, dan health memerlukan autentikasi.
- **Hasil yang Terjadi**: Rute logout no-op merespons 200 tanpa membaca atau mengubah data.
- **Dugaan File Penyebab**: `backend/src/routes/auth.ts`
- **Status**: Diterima sementara dan ditunda ke Task 5.6; logout klien tetap menghapus token lokal.
- **Task Terkait**: Task 5.3 / Task 5.6

### B-11 Parameter Halaman Tidak Memiliki Batas Maksimum
- **Tingkat**: P3
- **Langkah Mengulang**:
  1. Kirim `page` yang sangat besar pada daftar catatan atau percakapan asisten.
- **Hasil yang Diharapkan**: Parameter halaman di luar batas ditolak sebelum query database.
- **Hasil yang Terjadi**: Sebelumnya tidak ada batas maksimum, sehingga offset query dapat menjadi sangat besar.
- **Dugaan File Penyebab**: `backend/src/routes/notes.ts`, `backend/src/routes/assistant.ts`
- **Status**: Diperbaiki di Task 5.3; halaman maksimum 10.000. Uji router lokal mendapat 422 untuk 10.001 tanpa query database.
- **Task Terkait**: Task 5.3

### B-12 Filter Tag Tidak Membatasi Panjang Nilai
- **Tingkat**: P3
- **Langkah Mengulang**:
  1. Kirim filter tag lebih dari 30 karakter pada daftar catatan atau graph.
- **Hasil yang Diharapkan**: Filter dengan panjang di luar batas tag tersimpan ditolak.
- **Hasil yang Terjadi**: Sebelumnya query tag pada daftar catatan dan graph tidak memiliki batas panjang.
- **Dugaan File Penyebab**: `backend/src/routes/notes.ts`, `backend/src/routes/graph.ts`
- **Status**: Diperbaiki di Task 5.3; tag dibatasi 30 karakter. Uji router lokal mendapat 422 untuk 31 karakter.
- **Task Terkait**: Task 5.3

### B-13 Simpul Knowledge Graph Terlalu Kecil dan Halaman Harus Di-scroll
- **Tingkat**: P2
- **Langkah Mengulang**:
  1. Buka halaman `/graph` dengan beberapa catatan.
  2. Perhatikan ukuran judul simpul, sebaran graph, dan tinggi halaman.
- **Hasil yang Diharapkan**: Simpul dan judul mudah dibaca, graph tersebar, dan seluruh area kerja pas di tinggi layar.
- **Hasil yang Terjadi**: Simpul berbentuk kartu kecil dengan judul yang bertumpuk; area graph dapat melewati tinggi layar.
- **Dugaan File Penyebab**: `frontend/src/components/graph/GraphCanvas.tsx`, `frontend/src/components/graph/GraphContent.tsx`, `frontend/src/components/AppShell.tsx`
- **Status**: Diperbaiki pada redesign Knowledge Graph: simpul lingkaran dan ukuran berbatas, label selektif, layout ulang, serta tinggi halaman dikunci sesuai viewport.
- **Task Terkait**: Redesign Knowledge Graph
