# HANDOFF NALAR: Lanjut ke Task 3.1 (Notes CRUD backend)

Diperbarui: 11 Nov 2026 (Hari 7 dari 30). Sprint 2 SELESAI. Berikutnya Sprint 3, mulai Task 3.1.

## Cara memakai file ini
Tempel seluruh isi file ini ke AI baru di awal percakapan, lalu tulis: "Kerjakan Task 3.1 sesuai bagian 'Tugas untukmu'."

## Instruksi untuk AI yang menerima
Pemilik proyek adalah pelajar pemula web development di Indonesia, memakai Windows 11, VS Code, Git, dan GitHub. Aturan berkomunikasi:
- Pakai bahasa Indonesia sehari-hari yang mudah, hindari bahasa akademis.
- Beri langkah satu per satu, sebut dengan jelas nama file dan lokasinya (contoh: `backend/src/routes/notes.ts`). Beri isi file lengkap, bukan potongan, kecuali mengubah file yang sudah ada (tunjukkan baris yang ditambah dan letaknya).
- Perintah dijalankan di terminal VS Code. Sebut folder mana (`backend` atau `frontend`).
- Jangan pernah meminta pemilik menempel isi `.env` (isinya rahasia). Kalau perlu, minta nama variabelnya saja.
- Kalau ragu soal isi file yang ada, minta pemilik menempel isi file itu (bukan `.env`).
- Kalau ada error, minta pesan error apa adanya.
- Sebelum batas pemakaianmu habis, perbarui catatan serah terima ini (status dan langkah berikutnya) supaya bisa dilanjutkan AI lain.

## Tentang Nalar
Aplikasi web manajemen pengetahuan pribadi berbasis AI. Pengguna menulis catatan, AI meringkas dan mengambil konsep, catatan dicari berdasarkan makna, dihubungkan dalam knowledge graph, dan ditanyai lewat AI Assistant. Target selesai 30 hari (5 Nov - 4 Des 2026), untuk portofolio. Tagline: "Hubungkan Idemu. Temukan Pengetahuanmu."

## Stack dan versi
- Frontend: Next.js (App Router, folder `src/`), TypeScript, Tailwind
- Backend: Express + TypeScript, dijalankan dengan `tsx watch` (`npm run dev`), REST di `/api/v1`
- Database: Neon PostgreSQL + pgvector
- ORM: Prisma versi 6 (dipin ke versi 6 dengan sengaja). Kolom vektor memakai `Unsupported("vector(1536)")` dan raw SQL
- Auth: JWT (berlaku 1 hari) + `bcryptjs`
- Validasi: Zod
- Port: backend 4000, frontend 3000 (dokumen API menulis 5000, abaikan, yang benar 4000)

## Aturan dan keputusan (jangan dibalik tanpa alasan kuat)
- Satu jalur migrasi: Prisma migrate. Skema di `backend/prisma/schema.prisma`.
- Tidak ada lapisan `repositories/`. Cukup routes yang memanggil Prisma langsung.
- Kepemilikan data dijaga di kode: `userId` SELALU diambil dari token (`req.userId`), TIDAK PERNAH dari body atau parameter.
- Semua query ke catatan wajib difilter `userId`.
- Format response seragam (lihat di bawah).
- Frontend `apiFetch` memanggil `res.json()` untuk semua respons, jadi backend JANGAN membalas dengan status 204 tanpa isi. Pakai 200 dengan JSON.

## Format response
Berhasil:
```json
{ "success": true, "message": "Teks pesan", "data": {} }
```
Gagal:
```json
{ "success": false, "message": "Teks pesan", "errors": [] }
```
Untuk error validasi, `errors` berisi `[{ "field": "title", "message": "..." }]`.
Status yang dipakai: 200, 201, 401, 404, 409, 422, 500.

## Struktur proyek saat ini
```
nalar/
├── frontend/
│   ├── .env.local            (NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1)
│   ├── public/logo-symbol.svg
│   └── src/
│       ├── app/
│       │   ├── page.tsx              (redirect ke /dashboard)
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   ├── dashboard/page.tsx    (sementara: "Halo, nama" + tombol Keluar)
│       │   ├── layout.tsx, favicon.ico, icon.svg, apple-icon.png
│       └── lib/
│           ├── api.ts                (apiFetch, pesanError)
│           ├── auth.ts               (getToken, saveToken, clearToken; token di localStorage)
│           └── useRequireAuth.ts     (hook penjaga halaman, memanggil /auth/me)
└── backend/
    ├── .env                  (PORT, DATABASE_URL, JWT_SECRET; RAHASIA, jangan diminta)
    ├── prisma/schema.prisma
    └── src/
        ├── index.ts
        ├── lib/prisma.ts
        ├── lib/jwt.ts
        ├── middleware/auth.ts
        ├── routes/auth.ts
        └── types/express.d.ts
```

## Kode backend yang sudah ada (acuan gaya penulisan)

`src/index.ts` (kira-kira, urutan import bisa sedikit beda di laptop pemilik):
```ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth";

const app = express();
app.use(helmet());
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/api/v1/auth", authRoutes);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", app: "Nalar" });
});

app.get("/api/v1/health/db", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "terhubung" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend jalan di http://localhost:${port}`);
});
```

`src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

`src/types/express.d.ts` (membuat `req.userId` dikenali):
```ts
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
export {};
```

`src/middleware/auth.ts` (`requireAuth`: membaca header `Authorization: Bearer <token>`, mengisi `req.userId`, membalas 401 kalau gagal):
```ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Silakan login terlebih dahulu", errors: [] });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Token tidak valid atau sudah kedaluwarsa", errors: [] });
  }
}
```

Gaya route di `src/routes/auth.ts` (contoh potongan):
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(100),
  // ...
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      message: "Data tidak valid",
      errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  // ... pakai prisma, balas dengan res.status(201).json({...}); lalu return
});

export default router;
```
Catatan gaya: handler TIDAK memakai `return res.json(...)`. Pakai `res.json(...); return;` supaya TypeScript tidak protes. Periksa versi `express` di `backend/package.json`: kalau v5, error async otomatis diteruskan. Kalau v4, bungkus handler async dengan try/catch.

## Model Note di Prisma (sudah ada di schema)
```prisma
model Note {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  title     String   @db.VarChar(255)
  content   String
  summary   String?
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  // plus relasi ke NoteConcept, NoteRelationship, NoteEmbedding
  @@index([userId, updatedAt(sort: Desc)])
  @@map("notes")
}
```
Tabel lain di schema: User, Concept, NoteConcept, NoteRelationship, NoteEmbedding (vector 1536), AiConversation, AiMessage, ActivityLog. Belum ada tabel tag.

## Status
- Sprint 1 selesai (perencanaan).
- Sprint 2 selesai: setup proyek, Neon + Prisma (9 tabel), API register/login/logout/me, halaman login/register/dashboard sementara dengan token di localStorage dan penjaga halaman. Semua sudah diuji pemilik dan di-push ke GitHub.
- Belum diputuskan: palet warna UI (sementara tombol indigo; logo memakai crimson `#C02C48`, emas `#D2840F`, navy `#1C2530`).
- Belum ada tabel tag. Task 3.2 butuh tag, putuskan caranya saat sampai di sana (usul: kolom `tags String[]` di Note, atau tabel baru).
- Catatan beda dokumen: rencana task menulis endpoint ringkasan `POST /notes/:id/summary`, dokumen API menulis `POST /ai/summarize` dengan body `{ "noteId": "uuid" }`. Pakai dokumen API.

## TUGAS UNTUKMU: Task 3.1 Notes CRUD backend (Hari 8, 9 SP)
Epic [NOTE], prioritas Tinggi, label Backend. Hanya backend, tidak menyentuh frontend.

Subtask dan poin:
1. Cek model Note di Prisma sudah sesuai ERD (1 pt)
2. `POST /notes` membuat catatan (2 pts)
3. `GET /notes` dan `GET /notes/:id` (2 pts)
4. `PATCH /notes/:id` mengubah catatan (2 pts). Pakai PATCH sesuai dokumen API, bukan PUT.
5. `DELETE /notes/:id` (1 pt)
6. `userId` dari token, bukan dari input pengguna (1 pt)

Rancangan yang disepakati:
- File baru `backend/src/routes/notes.ts`. Pasang di `index.ts` dengan `app.use("/api/v1/notes", notesRoutes);`. Di dalam router, semua route dilindungi `router.use(requireAuth);`.
- Validasi Zod. Buat: `title` (trim, 1 sampai 255 karakter), `content` (trim, minimal 1). Ubah (PATCH): kedua field opsional, tapi minimal satu harus ada. Parameter `:id` divalidasi sebagai UUID. Kalau bukan UUID, balas 404 "Catatan tidak ditemukan" (bukan membiarkan Prisma melempar error 500).
- `POST /notes`: 201. Isi `data`: `id, title, content, summary, createdAt, updatedAt`. Pesan: "Catatan berhasil dibuat".
- `GET /notes`: ambil semua catatan milik pengguna, urut `updatedAt` terbaru dulu. Balas `data: { items: [...] }`. JANGAN buat pagination dan search sekarang (itu Task 3.3). Untuk daftar, tidak perlu mengirim `content` penuh. Kirim `id, title, summary, createdAt, updatedAt` dan `contentPreview` (200 karakter pertama isi). Bentuk `{ items }` dipilih supaya Task 3.3 tinggal menambah `pagination` tanpa mengubah bentuk.
- `GET /notes/:id`: kembalikan catatan lengkap (termasuk `content`). Cari dengan `findFirst({ where: { id, userId } })`. Kalau tidak ketemu atau milik orang lain, balas 404 (jangan 403, supaya keberadaan catatan orang lain tidak bocor).
- `PATCH /notes/:id`: cek kepemilikan dengan cara yang sama, lalu `update`. Pesan: "Catatan berhasil diperbarui".
- `DELETE /notes/:id`: cek kepemilikan, lalu `delete`. Balas 200 dengan JSON `{ success: true, message: "Catatan berhasil dihapus" }` (bukan 204).
- Jangan menambah fitur AI, embedding, tag, atau pagination di task ini.

Cara tes (Thunder Client di VS Code), semua dengan header Bearer token dari login:
1. Login untuk dapat `accessToken`. Pasang di tab Auth > Bearer.
2. `POST http://localhost:4000/api/v1/notes` dengan `{"title":"Belajar JavaScript","content":"JavaScript adalah bahasa pemrograman..."}` harus 201.
3. `GET /api/v1/notes` harus berisi catatan tadi. `GET /api/v1/notes/<id>` harus mengembalikan isi lengkap.
4. `PATCH /api/v1/notes/<id>` dengan `{"title":"Judul baru"}` harus 200, dan judul berubah.
5. Kirim `POST` dengan title kosong harus 422. Kirim request tanpa token harus 401. `GET /api/v1/notes/abc` harus 404.
6. Tes isolasi data (WAJIB): daftarkan akun kedua lewat `/auth/register`, login, lalu pakai token akun kedua untuk `GET`, `PATCH`, dan `DELETE` pada id catatan milik akun pertama. Ketiganya harus 404, dan `GET /notes` akun kedua harus kosong.
7. `DELETE /api/v1/notes/<id>` harus 200, lalu `GET` pada id yang sama harus 404.

Selesai (Definition of Done) bila: semua tes di atas lulus, tidak ada error merah di terminal backend, kode di-commit dengan pesan "notes crud backend" dan di-push ke GitHub, dan pemilik mencentang subtask Task 3.1 serta mengubah statusnya jadi Selesai di aplikasi tugasnya.

## Setelah Task 3.1
Urutan Sprint 3 (12-18 Nov, 60 SP):
- 3.2 Notes CRUD frontend (halaman My Notes, editor, hapus dengan konfirmasi, tag)
- 3.3 Validasi dan pagination (page, limit, search, filter tag, loading dan tampilan kosong)
- 3.4 Dashboard frontend (endpoint `GET /dashboard/stats`, kartu statistik, catatan terbaru, sidebar)
- 3.5 Integrasi OpenAI, 3.6 AI Summary, 3.7 Concept Extraction

Setelah sprint 3: Sprint 4 (embedding, pgvector, semantic search, graph, AI assistant) dan Sprint 5 (finalisasi dan rilis). Rincian lengkap subtask dan poin ada di dokumen rencana: https://claude.ai/artifact/BApWPz7emUD27NWxHWAcQn

## Aset lain
- Desain UI/UX 7 halaman (masih berbahasa Inggris, akan diterjemahkan ke Indonesia saat masa pengerjaan): https://claude.ai/artifact/XshdsHMNApnETbdwYJykox
- Logo dan ikon final ada di `nalar-brand.zip` milik pemilik (logo lengkap, simbol, ikon aplikasi, favicon, versi gelap).
- Dokumen proyek (PRD, Technical Design, Database Schema SQL, Neon Setup, API Specification, Roadmap) dimiliki pemilik sebagai file terpisah.
