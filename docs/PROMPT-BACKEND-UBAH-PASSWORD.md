# Prompt untuk agen AI: endpoint ubah password (backend)

Tempel semua yang ada di bawah garis ini ke agen AI pengoding.

---

Proyek Nalar (Express + TypeScript ESM, impor berakhiran `.js`, Prisma 6, Zod, Vitest + Supertest). Frontend sudah selesai untuk fitur "Ubah password" (file `frontend/src/components/ChangePasswordDialog.tsx`). Tugasmu hanya BACKEND. Jangan mengubah frontend, jangan menampilkan atau meminta isi `.env`.

## Yang harus dibuat
Endpoint `PATCH /api/v1/auth/password` di `backend/src/routes/auth.ts`, memakai `requireAuth`.

Body JSON: `{ "currentPassword": string, "newPassword": string }`

Validasi dengan Zod, ikuti gaya yang sudah ada di file itu:
- `currentPassword`: wajib diisi ("Password saat ini wajib diisi"), maksimal 72 byte (pakai `passwordWithinBcryptLimit`).
- `newPassword`: minimal 8 karakter ("Password baru minimal 8 karakter"), maksimal 72 byte ("Password maksimal 72 byte").
- `newPassword` tidak boleh sama dengan `currentPassword` -> galat pada field `newPassword`: "Password baru harus berbeda dari password saat ini".

## Perilaku
1. Ambil pengguna dari `req.userId` (jangan percaya userId dari body). Bila tidak ada, balas 401 seperti rute lain.
2. Bandingkan `currentPassword` dengan `passwordHash` memakai `bcrypt.compare`.
3. Jika password lama SALAH balas **400** (BUKAN 401) dengan:
   `{ success:false, message:"Password saat ini salah", errors:[{ field:"currentPassword", message:"Password saat ini salah" }] }`
   Alasan: frontend (`apiFetch`) menganggap 401 sebagai sesi habis lalu mengeluarkan pengguna dari akun.
4. Jika benar: `bcrypt.hash(newPassword, BCRYPT_ROUNDS)` lalu update `passwordHash` milik pengguna itu saja. Balas 200 `{ success:true, message:"Password berhasil diubah" }` (tanpa mengirim hash atau password apa pun).
5. Galat validasi balas 422 dengan format yang sama seperti `/register` (`errors:[{field, message}]`, field = `currentPassword` atau `newPassword`).
6. Pasang pembatas laju supaya password lama tidak bisa ditebak berulang. Pakai `batasAuth` (sudah ada, 10 percobaan per 15 menit dan hanya menghitung percobaan gagal), dipasang SETELAH `requireAuth`.
7. Jangan menulis password (lama atau baru) atau hash ke log mana pun.

## Tes (Vitest + Supertest, ikuti pola tes auth yang sudah ada, database tes terpisah)
- sukses: password berubah, login dengan password baru berhasil, login dengan password lama gagal
- password lama salah -> 400 dan password tidak berubah
- password baru sama dengan lama -> 422
- password baru kurang dari 8 karakter -> 422
- password baru lebih dari 72 byte -> 422
- tanpa token -> 401
- pengguna A tidak bisa mengubah password pengguna B (userId selalu dari token)
- respons tidak pernah memuat `passwordHash`

## Selesai bila
- `npx tsc --noEmit`, `npm test`, dan `npm run build` di folder backend lulus
- `docs/SECURITY-REPORT.md` dan dokumen API (jika ada daftar endpoint) ditambah satu baris untuk endpoint ini
- Tidak ada perubahan skema Prisma dan tidak ada migrasi baru (tidak diperlukan)

Setelah selesai, tulis ringkasan singkat dalam bahasa Indonesia sehari-hari: file yang diubah dan hasil tes.
