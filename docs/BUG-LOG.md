# Catatan Bug Nalar (BUG-LOG)

Dokumen ini mencatat bug, kendala, atau hal yang tidak semestinya ditemukan selama pengujian integrasi (Task 5.1).
*Catatan keamanan: Dokumen ini tidak boleh memuat API key, password, email asli, token, atau data rahasia/pribadi.*

---

## Ringkasan Bug

| Tingkat | Terbuka | Diperbaiki di 5.1 | Dipindah ke Task Lain | Total |
| :--- | :---: | :---: | :---: | :---: |
| **P1** (Kritis / Bocor Data / Rusak Total) | 0 | 1 | 0 | 1 |
| **P2** (Fitur Bermasalah / Membingungkan)   | 0 | 2 | 0 | 2 |
| **P3** (Kosmetik / Tampilan / Bahasa)       | 0 | 0 | 0 | 0 |
| **Total**                                   | **0** | **3** | **0** | **3** |

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
