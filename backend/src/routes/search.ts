import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createEmbedding, kirimErrorAi, AiError } from "../services/ai.service.js";
import { cariCatatanMirip } from "../services/vector.service.js";
import { ambilKamus, koreksiKalimat } from "../lib/koreksiTypo.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------
// 1. In-Memory Cache (Maks 100 entri, TTL 10 menit)
// ---------------------------------------------------------
interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit
const MAX_CACHE_ENTRIES = 100;
const embeddingCache = new Map<string, CacheEntry>();

function getCachedEmbedding(userId: string, query: string): number[] | null {
  const key = `${userId}:${query.toLowerCase().trim()}`;
  const entry = embeddingCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    embeddingCache.delete(key);
    return null;
  }
  return entry.embedding;
}

function setCachedEmbedding(userId: string, query: string, embedding: number[]) {
  if (embeddingCache.size >= MAX_CACHE_ENTRIES) {
    // Hapus entri tertua (LRU/FIFO sederhana dari Map keys)
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) {
      embeddingCache.delete(firstKey);
    }
  }
  const key = `${userId}:${query.toLowerCase().trim()}`;
  embeddingCache.set(key, {
    embedding,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------
// 2. Simple Rate Limiter (15 req/menit, 200 req/hari per user)
// ---------------------------------------------------------
interface RateLimitRecord {
  minuteWindowStart: number;
  minuteCount: number;
  dayWindowStart: number;
  dayCount: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const ONE_MINUTE = 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let record = rateLimitMap.get(userId);
  if (!record) {
    record = {
      minuteWindowStart: now,
      minuteCount: 1,
      dayWindowStart: now,
      dayCount: 1,
    };
    rateLimitMap.set(userId, record);
    return true;
  }

  // Cek jendela menit
  if (now - record.minuteWindowStart > ONE_MINUTE) {
    record.minuteWindowStart = now;
    record.minuteCount = 1;
  } else {
    record.minuteCount += 1;
  }

  // Cek jendela hari
  if (now - record.dayWindowStart > ONE_DAY) {
    record.dayWindowStart = now;
    record.dayCount = 1;
  } else {
    record.dayCount += 1;
  }

  if (record.minuteCount > 15 || record.dayCount > 200) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------
// Helper perapian cuplikan (maks 160 karakter)
// ---------------------------------------------------------
function buatCuplikan(teks: string, maxLen = 160): string {
  // Ganti baris baru dan spasi ganda dengan 1 spasi
  const rapi = teks.replace(/\s+/g, " ").trim();
  if (rapi.length <= maxLen) {
    return rapi;
  }
  return rapi.slice(0, maxLen).trim() + "...";
}

// ---------------------------------------------------------
// Validasi Query Schema
// ---------------------------------------------------------
const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Kata kunci pencarian minimal 2 karakter.")
    .max(200, "Kata kunci pencarian maksimal 200 karakter."),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 10;
      const num = parseInt(val, 10);
      return isNaN(num) ? 10 : num;
    })
    .refine((val) => val >= 1 && val <= 20, {
      message: "Limit pencarian harus berupa angka antara 1 sampai 20.",
    }),
});

/**
 * GET /api/v1/search?q=...&limit=10
 */
router.get("/", async (req, res) => {
  const waktuMulai = Date.now();
  const userId = req.userId!;

  // 1. Cek rate limit
  if (!checkRateLimit(userId)) {
    res.status(429).json({
      success: false,
      message: "Terlalu banyak pencarian. Coba lagi sebentar lagi.",
      errors: [],
    });
    return;
  }

  // 2. Validasi input
  const parseResult = searchQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(422).json({
      success: false,
      message: "Parameter pencarian tidak valid.",
      errors: parseResult.error.issues.map((issue) => ({
        field: issue.path.join(".") || "q",
        message: issue.message,
      })),
    });
    return;
  }

  const { q, limit } = parseResult.data;

  // 2.5 Koreksi Typo Berbasis Kamus Catatan Pengguna (0 panggilan AI)
  let teksPencarian = q;
  let infoKoreksi: { asli: string; dipakai: string; perubahan: { dari: string; ke: string }[] } | null = null;
  try {
    const kamus = await ambilKamus(userId);
    const hasilKoreksi = koreksiKalimat(q, kamus);
    if (hasilKoreksi.perubahan.length > 0) {
      teksPencarian = hasilKoreksi.dipakai;
      infoKoreksi = hasilKoreksi;
    }
  } catch {
    // Lewati koreksi jika gagal membangun kamus
  }

  // 3. Hitung catatan milik user yang belum terindeks embedding
  const hitungBelumDiindeks = async (): Promise<number> => {
    try {
      const baris = await prisma.$queryRaw<[{ count: bigint | number }]>`
        SELECT COUNT(n.id) AS count
        FROM notes n
        LEFT JOIN note_embeddings e ON n.id = e.note_id
        WHERE n.user_id = ${userId}::uuid AND e.note_id IS NULL
      `;
      return Number(baris[0]?.count ?? 0);
    } catch {
      return 0;
    }
  };

  // 4. Pencarian cadangan (kata biasa) helper
  const jalankanPencarianKata = async (
    pesanKhusus = "Pencarian makna sedang tidak tersedia, menampilkan pencarian kata biasa."
  ) => {
    const notes = await prisma.note.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: teksPencarian, mode: "insensitive" } },
          { content: { contains: teksPencarian, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const belumDiindeks = await hitungBelumDiindeks();
    const durasi = Date.now() - waktuMulai;
    console.log(`[Search] mode=kata hasil=${notes.length} durasi=${durasi}ms`);

    res.status(200).json({
      success: true,
      message: pesanKhusus,
      data: {
        mode: "kata",
        query: q,
        koreksi: infoKoreksi,
        results: notes.map((n) => ({
          noteId: n.id,
          title: n.title,
          cuplikan: buatCuplikan(n.content),
          tags: n.tags,
          similarity: null,
          updatedAt: n.updatedAt,
        })),
        belumDiindeks,
      },
    });
  };

  // 5. Coba pencarian makna dengan embedding
  let embedding = getCachedEmbedding(userId, teksPencarian);
  let cacheHit = false;

  if (embedding) {
    cacheHit = true;
  } else {
    try {
      const embRes = await createEmbedding(teksPencarian);
      embedding = embRes.embedding;
      setCachedEmbedding(userId, teksPencarian, embedding);
    } catch (err: any) {
      // Periksa apakah error karena kuota habis atau service gangguan
      const status =
        err instanceof AiError
          ? err.providerStatus ?? err.status
          : err?.status;

      // Cadangan untuk 429 (kuota/rate limit), 502, 503, timeout
      const isQuotaOrServiceIssue =
        status === 429 ||
        status === 502 ||
        status === 503 ||
        err?.status === 502 ||
        err?.code === "ETIMEDOUT" ||
        err?.name === "APIConnectionTimeoutError" ||
        err?.name === "TimeoutError";

      if (isQuotaOrServiceIssue) {
        await jalankanPencarianKata();
        return;
      }

      // Untuk error konfigurasi (401/403/dimensi salah/dll), kirim error AI
      kirimErrorAi(res, err);
      return;
    }
  }

  // 6. Cari catatan mirip via pgvector
  try {
    const hasilMirip = await cariCatatanMirip({
      userId,
      embedding,
      batas: limit,
    });

    const noteIds = hasilMirip.map((h) => h.noteId);

    // Ambil detail catatan (dobel cek kepemilikan userId)
    const catatanDetail = await prisma.note.findMany({
      where: {
        id: { in: noteIds },
        userId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        updatedAt: true,
      },
    });

    const detailMap = new Map(catatanDetail.map((c) => [c.id, c]));

    // Susun hasil sesuai urutan similarity dari hasilMirip
    const results = hasilMirip
      .filter((h) => detailMap.has(h.noteId))
      .map((h) => {
        const detail = detailMap.get(h.noteId)!;
        return {
          noteId: detail.id,
          title: detail.title,
          cuplikan: buatCuplikan(detail.content),
          tags: detail.tags,
          similarity: h.similarity,
          updatedAt: detail.updatedAt,
        };
      });

    const belumDiindeks = await hitungBelumDiindeks();
    const durasi = Date.now() - waktuMulai;
    console.log(
      `[Search] mode=makna hasil=${results.length} cache=${cacheHit ? "hit" : "miss"} durasi=${durasi}ms`
    );

    res.status(200).json({
      success: true,
      message: "Pencarian selesai.",
      data: {
        mode: "makna",
        query: q,
        koreksi: infoKoreksi,
        results,
        belumDiindeks,
      },
    });
    return;
  } catch (error: any) {
    console.error("[Search Error]", error?.name, error?.message);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memproses pencarian.",
      errors: [],
    });
    return;
  }
});

export default router;
