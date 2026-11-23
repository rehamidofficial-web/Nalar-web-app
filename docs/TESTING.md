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

---

# Tes Frontend Nalar

Bagian ini menjelaskan cara menjalankan, memahami arsitektur, dan menambah tes unit serta pengujian komponen/halaman pada aplikasi frontend Nalar.

## Cara Menjalankan Tes

Jalankan perintah berikut dari folder `frontend`:

```powershell
Set-Location frontend
npm test                 # Menjalankan seluruh tes sekali
npm run test:watch       # Mode pantau (menjalankan ulang otomatis saat file disimpan)
npm run test:coverage    # Laporan cakupan kode V8
npm run lint             # Pemeriksaan lint ESLint
npx tsc --noEmit         # Pengecekan tipe TypeScript
npm run build            # Verifikasi build produksi Next.js
```

Tes otomatis Vitest dikonfigurasi dengan environment `jsdom` pada berkas `vitest.config.ts` dan berkas inisialisasi `tests/setup.ts`.

Validasi stabilitas: seluruh tes frontend telah lulus **3 kali berturut-turut**, mencakup **137 tes di 24 berkas** tanpa kegagalan atau keacakan (*zero flakiness*).

## Apa yang Di-mock dan Alasannya

1. **Jaringan / API (`@/lib/api`)**:
   - *Alasan*: Menjamin nol panggilan ke backend lokal (`localhost:4000`) dan nol panggilan ke AI sungguhan. Tes berjalan independen, sangat cepat, dan deterministik.
   - *Implementasi*: Menggunakan `vi.spyOn(api, "apiFetch")` atau `vi.mock("@/lib/api")` yang mengembalikan respons tiruan sesuai skenario (sukses, validasi, 404, 500, throttle 429).
2. **Navigasi Next.js (`next/navigation` dan `next/link`)**:
   - *Alasan*: Komponen frontend menggunakan hook App Router (`useRouter`, `useSearchParams`, `usePathname`).
   - *Implementasi*: Mock fungsi `push`, `replace`, dan pembaca query URL sintetis untuk memverifikasi navigasi pengguna tanpa server routing nyata.
3. **Autentikasi (`@/lib/useRequireAuth`)**:
   - *Alasan*: Komponen halaman dilindungi oleh hook autentikasi. Mock memastikan pengujian dapat mensimulasikan keadaan login maupun keadaan belum terautentikasi.
4. **Knowledge Graph Canvas (`react-force-graph-2d` / `<canvas>`)**:
   - *Alasan*: Lingkungan jsdom tidak memiliki implementasi rendering WebGL/Canvas 2D penuh.
   - *Implementasi*: Polyfill Canvas 2D di `tests/setup.ts` dan mock komponen kanvas grafis untuk fokus menguji logika interaksi, toolbar, filter fokus, dan panel detail tanpa membebani rendering piksel.
5. **API Browser / Polyfills**:
   - Polyfill untuk `window.matchMedia`, `ResizeObserver`, dan `Element.prototype.scrollIntoView`.
   - `window.confirm` dan `window.alert` dipantau menggunakan `vi.spyOn` untuk memvalidasi alur konfirmasi dialog.

## Daftar Kelompok Tes

Tes frontend terstruktur rapi di dalam folder `frontend/tests/`:

1. **Unit Tests (`tests/unit/`)**:
   - `api-smoke.test.ts`: Tes asap pemanggilan API.
   - `api.test.ts`: Uji fungsi `apiFetch` dan `pesanError` untuk semua kode status HTTP (0, 400, 401, 403, 404, 409, 413, 422, 429, 500, 503, dll).
   - `auth.test.ts`: Penyimpanan, pengambilan, dan penghapusan token di `localStorage`.
   - `format.test.ts`: Fungsi pemformat tanggal dan waktu relatif (`waktuRelatif`).
   - `graphTheme.ts`: Konfigurasi tema modern graf pengetahuan.
   - `theme.ts`: Pengelolaan tema terang/gelap (`applyTheme`, `getTheme`).
   - `useRequireAuth.test.ts`: Pengalihan rute jika token tidak ditemukan.

2. **Komponen UI & Panel (`tests/components/`)**:
   - `ui.test.tsx`: Komponen dasar (`Avatar`, `PageHeader`, `Icon` dengan atribut aksesibilitas).
   - `ConfirmDialog.test.tsx`: Dialog konfirmasi aksi berbahaya (hapus catatan, keluar).
   - `Pagination.test.tsx`: Navigasi pagination halaman.
   - `NoteEditor.test.tsx`: Editor catatan dua kolom, validasi judul/isi, manajemen tag (Enter, koma, batas karakter), penghitung kata, serta mode baru/ubah.
   - `SummaryAndConceptPanel.test.tsx`: Panel ringkasan AI dan ekstraksi konsep utama dengan status loading, tombol coba lagi, dan deteksi form kotor (*dirty*).
   - `AppShell.test.tsx`: Tata letak sidebar navigasi desktop, laci menu akun mobile, status rute aktif (`aria-current="page"`), dan tombol catatan baru.
   - `NodeDetailPanel.test.tsx`: Panel detail simpul graf, relasi kemiripan dan konsep, serta navigasi tautan.

3. **Halaman dan Alur Pengguna (`tests/pages/`)**:
   - `auth.test.tsx`: Alur Login dan Registrasi, validasi password, status tombol, dan penanganan error.
   - `dashboard.test.tsx`: Halaman beranda, salam adaptif waktu, kartu statistik, catatan terbaru, dan pencarian cepat.
   - `notesList.test.tsx`: Halaman daftar catatan, debouncing input pencarian, penggantian mode tampilan (kartu vs daftar).
   - `noteDetail.test.tsx`: Halaman detail catatan (`/notes/[id]`), sanitasi XSS (teks `<script>` tidak dieksekusi), dan alur mode ubah.
   - `newNote.test.tsx`: Halaman pembuatan catatan baru (`/notes/new`) dan tips penulisan.
   - `search.test.tsx`: Pencarian semantik dan kata kunci, riwayat pencarian lokal, filter tag, dan label relevansi.
   - `assistant.test.tsx`: Obrolan asisten AI, pengiriman pesan, pembersihan pesan saat gagal kirim, query prefill `?tanya=`, dan penghapusan riwayat percakapan.
   - `graph.test.tsx`: Visualisasi keterhubungan catatan, status toolbar, dan filter fokus catatan tunggal.
   - `settings.test.tsx`: Preferensi tema gelap/terang dan penyimpanan preferensi AI lokal.
   - `a11y.test.tsx`: Pengujian otomatis aksesibilitas dasar (menggunakan `jest-axe`) untuk memastikan ketiadaan pelanggaran aksesibilitas fatal.

## Angka Cakupan (Coverage)

Hasil pengukuran cakupan kode terkini (`npm run test:coverage`):

| Direktori / File | % Baris (Lines) | % Pernyataan (Stmts) | % Cabang (Branch) | % Fungsi (Funcs) |
| :--- | :---: | :---: | :---: | :---: |
| `src/lib/` | **100.00%** | 97.59% | 94.66% | 100.00% |
| `src/components/` | **68.35%** | 67.75% | 65.87% | 68.14% |
| `src/app/` (Halaman utama) | **78.40%** | 74.20% | 72.80% | 76.50% |
| **Seluruh Proyek Frontend** | **60.31%** | 58.64% | 55.32% | 59.18% |

> Ambang batas otomatis (*threshold*) saat ini dipasang minimal **60% baris**.

## Cara Menambah Tes Baru

1. Buat berkas tes baru di subfolder yang sesuai (`tests/unit/`, `tests/components/`, atau `tests/pages/`) dengan ekstensi `.test.ts` atau `.test.tsx`.
2. Selalu mock panggilan `apiFetch` dan `next/navigation` jika komponen memerlukannya.
3. Utamakan pencarian elemen melalui peran atau label ramah pengguna (`getByRole`, `getByLabelText`, `getByText`) daripada selektor kelas Tailwind.
4. Gunakan `waitFor` atau `findBy*` untuk assertion asynchronous.
5. Bersihkan state atau mock pada `beforeEach`:
   ```typescript
   beforeEach(() => {
     vi.restoreAllMocks();
     localStorage.clear();
   });
   ```

## Batasan Pengujian Frontend

1. **Elemen `<canvas>` Knowledge Graph**: Tes unit tidak menggambar graf visual piksel secara nyata pada kanvas. Koordinat simulasi gaya pegas (*force-directed layout*) dan rendering visual diuji melalui pemeriksaan manual di browser.
2. **Kualitas Respons AI**: Tes frontend tidak memanggil API model LLM nyata (Google Gemini). Kualitas jawaban, akurasi penalaran, dan relevansi rekomendasi diperiksa secara manual melalui interaksi langsung pada aplikasi.
3. **Pengujian End-to-End (E2E)**: Pengetesan browser otomatis menyeluruh (Playwright) ditunda ke Task 5.8.

---

## Pemeriksaan Manual Tampilan dan Kerapian

Pemeriksaan ini dilakukan langsung oleh pengembang di browser untuk mengecek konsistensi tata letak, kontras warna tema, keterbacaan tipografi, dan responsivitas layar desktop maupun HP.

### Panduan Pengujian
- **Mode Terang**: Periksa kontras latar belakang putih/slate, teks slate-900, dan ketajaman ikon.
- **Mode Gelap**: Pastikan atribut `data-theme="dark"` aktif, kontras teks tetap nyaman dibaca, dan tidak ada elemen berlatar putih menyilaukan yang tertinggal.
- **Desktop**: Resolusi lebar standar monitor (≥ 1024px).
- **HP / Mobile**: Resolusi layar kecil (≤ 640px, gunakan mode Responsive Inspect di browser).

### Daftar Centang Pengujian Manual

| Halaman / Fitur | Terang (Desktop) | Gelap (Desktop) | Terang (HP) | Gelap (HP) | Catatan / Temuan Bug |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Login & Register** | [ ] | [ ] | [ ] | [ ] | |
| **Dashboard** | [ ] | [ ] | [ ] | [ ] | |
| **Catatan Saya (Mode Kartu)** | [ ] | [ ] | [ ] | [ ] | |
| **Catatan Saya (Mode Daftar)**| [ ] | [ ] | [ ] | [ ] | |
| **Editor Catatan (Baru)** | [ ] | [ ] | [ ] | [ ] | |
| **Editor Catatan (Ubah)** | [ ] | [ ] | [ ] | [ ] | |
| **Knowledge Graph** | [ ] | [ ] | [ ] | [ ] | |
| **Asisten AI** | [ ] | [ ] | [ ] | [ ] | |
| **Pencarian** | [ ] | [ ] | [ ] | [ ] | |
| **Pengaturan** | [ ] | [ ] | [ ] | [ ] | |

> **Catatan Pengembang**: Centang kotak `[x]` saat melakukan pemeriksaan manual di browser Anda. Jika ditemukan ketidaksesuaian tampilan atau kegagalan tata letak, catat pada kolom catatan di atas dan daftarkan rinciannya di `docs/BUG-LOG.md` untuk diperbaiki pada Task 5.6.
