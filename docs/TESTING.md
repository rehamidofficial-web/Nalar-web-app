# Tes Backend Nalar

Panduan ini menjelaskan cara menjalankan dan menambah tes backend. Tes integrasi menggunakan database tes terpisah; jangan arahkan tes ke database produksi.

## Menyiapkan database tes

1. Di Neon, buat cabang khusus tes yang terpisah dari database produksi.
2. Salin connection string cabang tes dan simpan hanya secara lokal di `backend/.env.test`. Jangan kirim nilainya ke chat atau commit ke Git.
3. Jika belum ada, salin `backend/.env.test.example` menjadi `backend/.env.test`. Contoh aman di PowerShell:

   ```powershell
   Set-Location backend
   if (-not (Test-Path .env.test)) { Copy-Item .env.test.example .env.test }
   ```

   File contoh hanya memuat nama variabel:

   ```dotenv
   DATABASE_URL=
   ```

4. Dari PowerShell, jalankan migrasi pada cabang tes:

   ```powershell
   Set-Location backend
   npm ci
   npm run db:migrate:test
   ```

Skrip migrasi menolak lingkungan produksi, memastikan `DATABASE_URL` terisi, dan menolak URL yang sama dengan `.env` utama. Jangan membuka atau membagikan nilai URL untuk meminta bantuan.

## Menjalankan tes

Jalankan perintah dari folder `backend`:

```powershell
npm test
npm run test:watch
npm run test:coverage
npx tsc --noEmit
```

`npm test` menjalankan seluruh tes sekali. `npm run test:watch` menjalankannya dalam mode pantau. `npm run test:coverage` membuat laporan V8 di `backend/coverage/`, yang diabaikan Git.

Vitest memakai environment Node dan memuat `backend/.env.test` melalui `tests/setup.ts`. Tes dihentikan jika `NODE_ENV=production`. `fileParallelism: false` menjaga tes berbagi database agar berjalan berurutan.

Validasi terakhir: `npm test` lulus **3 kali berturut-turut**, masing-masing dengan 98 tes pada 19 berkas.

## Cakupan saat ini

Diukur dengan `npm run test:coverage` setelah 98 tes pada 19 berkas lulus:

| Folder sumber | Baris | Cabang |
| --- | ---: | ---: |
| `src/lib` | 88,69% | 81,30% |
| `src/routes` | 80,55% | 60,30% |
| `src/services` | 93,95% | 80,39% |
| **Semua folder** | **84,68%** | **69,63%** |

Ambang otomatis saat ini adalah cakupan **baris 60%** untuk `src/lib`, `src/routes`, dan `src/services`. Cakupan cabang dilaporkan, tetapi belum menjadi ambang gagal. Angka dapat berubah ketika kode atau tes berubah.

## Kelompok tes integrasi

Tes integrasi berada di `tests/integration/`:

1. Auth.
2. Catatan.
3. Isolasi data dua akun.
4. Ringkasan dan ekstraksi konsep AI.
5. Embedding dan relasi.
6. Pencarian.
7. Graph dan dashboard.
8. Asisten dan percakapan.
9. Preview dan penyimpanan gabungan catatan.
10. Error HTTP dan pembatas laju.
11. Keamanan API.

Tes tanpa database berada di `tests/unit/`. Helper bersama berada di `tests/helpers/`.

## AI tiruan dan pembersihan data

Tes tidak memanggil layanan AI sungguhan:

- `helpers/mockAi.ts` memberi hasil chat dan embedding deterministik.
- `helpers/mockBackgroundEmbedding.ts` mencegah pekerjaan embedding latar belakang berjalan sungguhan dalam tes yang tidak mengujinya.
- Unit test `ai.service.ts` memakai mock SDK OpenAI.

Akun integrasi memakai alamat sintetis berakhiran `@tes-nalar.invalid`. Helper menghapus data lama sebelum tes dan menghapus akun tes setelah tes selesai. Setelah suite terakhir, jumlah akun dengan akhiran tersebut terverifikasi **0**. Jika suite terhenti paksa, tes berikutnya akan mencoba membersihkan akun sisa sebelum memulai.

## Menambah tes

- Tambahkan tes fungsi murni di `tests/unit/`; hindari database dan jaringan.
- Tambahkan tes endpoint di berkas kelompok terkait dalam `tests/integration/`.
- Untuk tes integrasi, gunakan akun sintetis dari `helpers/testData.ts`, `createTestClient()`, dan mock AI. Tambahkan cleanup akun di `afterAll`.
- Jangan memakai AI provider sungguhan, database produksi, `.env` utama, atau data pengguna nyata.
- Tes API sebaiknya memeriksa status HTTP dan bentuk respons. Untuk pekerjaan latar belakang, gunakan polling berbatas waktu, bukan jeda tetap.
- Jalankan tes terarah dan `npx tsc --noEmit`; sebelum menyelesaikan perubahan, jalankan suite lengkap.

## Batasan

Karena respons AI dan embedding ditirukan, tes ini memeriksa integrasi, penyimpanan, dan penanganan error—bukan mutu jawaban Gemini atau perilaku provider langsung. Evaluasi mutu AI sungguhan tetap perlu dilakukan secara manual di luar suite tes.
