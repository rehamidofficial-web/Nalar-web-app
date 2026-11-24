# Catatan Performa Nalar (Task 5.7)

Tanggal: 24 Nov 2026

## Ringkasan singkat
- Menambah index di database untuk pencarian kata, urutan judul, dan filter tag.
- Mengurangi panggilan AI yang tidak perlu dan satu kali tunggu database di pencarian.
- Membatasi pembuatan kamus koreksi typo (maksimal 500 catatan terbaru).
- Frontend: daftar tag tidak diambil ulang tiap kali halaman daftar catatan berubah, dan font memakai satu berkas variabel.

## Hasil pengukuran
Diukur di Postgres lokal dengan data buatan (bukan data asli dan bukan Neon), jadi angkanya untuk perbandingan sebelum dan sesudah, bukan janji kecepatan di produksi. Waktu jaringan ke Neon belum ikut terhitung. Query pgvector tidak bisa diukur karena database uji tidak punya pgvector.

| Query | Sebelum | Sesudah | Keterangan |
|---|---|---|---|
| Cari kata di daftar catatan | lambat (scan seluruh tabel) | sekitar 4 sampai 8 kali lebih cepat | index trigram (pg_trgm) |
| Urut judul A-Z | scan + sort | sekitar 40 kali lebih cepat | index `(userId, title)` |
| Hitung hasil pencarian kata | sekitar 50 ms lebih lambat | lebih cepat | index trigram |
| Filter tag | scan | cepat (sekitar 0,5 ms) | index GIN pada `tags` |
| Daftar catatan terbaru | sudah cepat | sudah cepat (sekitar 0,2 ms) | index sudah ada sejak awal |
| Graph, dashboard, relasi | 1 sampai 6 ms | tidak diubah | sudah cepat, tidak perlu index tambahan |

Satu kasus justru sedikit lebih lambat: daftar catatan dengan kata yang sangat umum (sekitar 2,2 ms menjadi 8,3 ms). Saya terima karena selisihnya kecil, dan hitungan totalnya jadi jauh lebih cepat.

## Harga yang dibayar index
- Index isi catatan (trigram) berukuran sekitar 1,7 kali teks catatan. Neon paket gratis 0,5 GB, jadi pantau pemakaian.
- Setiap simpan catatan sekitar 1,4 ms lebih lama. Tidak terasa untuk pemakaian biasa.

## Perubahan kode
Backend
- `prisma/schema.prisma` dan migrasi `20261124140000_index_performa`: ekstensi `pg_trgm` dan 4 index (`notes_user_id_title_idx`, `idx_notes_judul_trgm`, `idx_notes_isi_trgm`, `idx_notes_tags_gin`).
- `routes/search.ts`: kata kunci yang embedding-nya sudah ada di cache tidak memakai jatah AI harian (60 per hari). Dua query yang tidak saling bergantung dijalankan bersamaan.
- `middleware/rateLimit.ts` dan `types/express.d.ts`: opsi `skip` untuk batas AI harian.
- `lib/koreksiTypo.ts`: kamus typo dibangun dari paling banyak 500 catatan terbaru.
- `scripts/analisis-query.sql`: kumpulan query `EXPLAIN ANALYZE` (hanya membaca) untuk mengukur ulang.

Frontend
- `components/NotesList.tsx`: `/notes/tags` diambil sendiri, tidak ikut diambil ulang saat daftar berubah.
- `app/layout.tsx`: Plus Jakarta Sans versi variabel (satu berkas). File ini sudah memuat perubahan Task 5.6.

## Cara mengukur ulang
1. Buka `backend/scripts/analisis-query.sql`.
2. Ganti `GANTI-ID`, `kata_uji`, dan `tag_uji` dengan data Anda.
3. Jalankan di SQL Editor Neon, per query. Perhatikan `Execution Time` dan apakah plan memakai `Bitmap Index Scan` (artinya index dipakai).
Query nomor 9 (pgvector) belum pernah dicoba.

## Cara membatalkan index
```sql
DROP INDEX IF EXISTS idx_notes_judul_trgm, idx_notes_isi_trgm, idx_notes_tags_gin, notes_user_id_title_idx;
```
Setelah itu hapus folder migrasi `20261124140000_index_performa` dan kembalikan `schema.prisma`, supaya Prisma tidak mengira ada perbedaan.

## Yang belum dikerjakan (batasan yang diketahui)
- Daftar, dashboard, dan pencarian mengambil isi catatan penuh lalu dipotong. Kalau catatan sudah banyak dan panjang, bisa ditambah kolom `preview`.
- Ringkasan dan ekstraksi konsep memanggil AI setiap kali tombol ditekan.
- Klien OpenAI memakai `maxRetries: 1`, jadi saat kena batas (429) permintaan bisa terhitung dua kali.
- Pencarian makna memfilter `userId` setelah index HNSW. Untuk pengguna dengan data sangat banyak, hasil bisa kurang. Opsi: `hnsw.iterative_scan`.
- Ukuran bundle frontend: hasil `npm run build` Next.js 16 tidak menampilkan tabel ukuran. Untuk melihatnya jalankan `npx next experimental-analyze` di folder frontend.
- Ada berkas ikon dengan ekstensi ganda (nama file berakhiran dua ekstensi). Tidak berbahaya, tapi sebaiknya dirapikan.
